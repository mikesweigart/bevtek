-- User hold preferences — remember how customers want to be reached.
--
-- Adds a free-form preferences jsonb bucket on users, then teaches
-- request_hold_v2 to stash notify_channel / phone / email there every
-- time a hold is placed. A tiny my_hold_preferences() RPC surfaces
-- them back so the mobile hold dialog can prefill contact details on
-- repeat visits — the shopper confirms instead of re-typing.

alter table public.users
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Read back the preferences for the current user — shape is stable
-- so the mobile client can destructure without null-juggling.
create or replace function public.my_hold_preferences()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'notify_channel', coalesce(preferences->>'notify_channel', null),
    'phone',          coalesce(preferences->>'phone', null),
    'email',          coalesce(preferences->>'email', email)
  )
  from public.users
  where id = auth.uid();
$$;

grant execute on function public.my_hold_preferences() to authenticated;

-- Replace request_hold_v2 with a version that writes back the shopper's
-- last-used contact prefs alongside the hold insert.
create or replace function public.request_hold_v2(
  p_item_id        uuid,
  p_notify_channel text,
  p_phone          text default null,
  p_email          text default null,
  p_quantity       int default 1,
  p_notes          text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    record;
  v_item    record;
  v_hold_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  if p_notify_channel not in ('sms','email','both') then
    raise exception 'notify_channel must be sms, email, or both' using errcode = '22023';
  end if;

  if p_notify_channel in ('sms','both') and (p_phone is null or length(trim(p_phone)) = 0) then
    raise exception 'phone is required for SMS' using errcode = '22023';
  end if;
  if p_notify_channel in ('email','both') and (p_email is null or length(trim(p_email)) = 0) then
    raise exception 'email is required for email' using errcode = '22023';
  end if;

  select id, store_id, email, full_name, role into v_user
  from public.users where id = auth.uid();

  if p_quantity is null or p_quantity < 1 then p_quantity := 1; end if;
  if p_quantity > 50 then raise exception 'quantity too large' using errcode = '22023'; end if;

  select id, name, brand, price, sku, stock_qty, store_id into v_item
  from public.inventory where id = p_item_id and is_active = true;
  if v_item is null then raise exception 'item not available' using errcode = '22023'; end if;

  insert into public.hold_requests (
    store_id, item_id, item_snapshot,
    customer_name, customer_email, customer_phone, customer_user_id,
    notify_channel,
    quantity, notes, source, status
  ) values (
    v_item.store_id, v_item.id,
    json_build_object('name', v_item.name, 'brand', v_item.brand,
                      'sku', v_item.sku, 'price', v_item.price,
                      'stock_at_request', v_item.stock_qty),
    coalesce(v_user.full_name, split_part(coalesce(v_user.email, p_email, 'customer'), '@', 1)),
    coalesce(nullif(trim(coalesce(p_email,'')), ''), v_user.email),
    nullif(trim(coalesce(p_phone, '')), ''),
    v_user.id,
    p_notify_channel,
    p_quantity,
    nullif(trim(coalesce(p_notes, '')), ''),
    case when v_user.role = 'customer' then 'shopper' else 'in_store' end,
    'pending'
  )
  returning id into v_hold_id;

  -- Remember these contact prefs for next time — merge in place so we
  -- don't clobber other preference keys (theme, locale, whatever).
  update public.users
  set preferences = coalesce(preferences, '{}'::jsonb) || jsonb_build_object(
    'notify_channel', p_notify_channel,
    'phone',          nullif(trim(coalesce(p_phone, '')), ''),
    'email',          nullif(trim(coalesce(p_email, '')), '')
  )
  where id = v_user.id;

  return json_build_object(
    'hold_id', v_hold_id,
    'item_name', v_item.name,
    'price', v_item.price,
    'quantity', p_quantity
  );
end;
$$;

grant execute on function public.request_hold_v2(uuid, text, text, text, int, text) to authenticated;
