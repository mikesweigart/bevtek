-- In-store virtual shopper — hold state machine v2 + virtual cart.
--
-- Extends hold_requests with the staff two-step workflow
-- (Accept & Grab → Item Placed at Front) plus a "Cannot Fulfill" exit
-- with a reason. Also adds customer notify channel and a cart_items
-- table for the "Add to Virtual Cart" action.

-- ---------------------------------------------------------------------------
-- 1. hold_requests — new status values + tracking columns
-- ---------------------------------------------------------------------------

alter table public.hold_requests
  drop constraint if exists hold_requests_status_check;

alter table public.hold_requests
  add constraint hold_requests_status_check
  check (status in (
    'pending',           -- customer requested, staff hasn't seen yet ("Requested")
    'in_progress',       -- staff accepted, physically grabbing it
    'confirmed',         -- staff placed it at the front — ready for pickup
    'picked_up',         -- customer collected
    'cannot_fulfill',    -- staff couldn't get it (OOS / not found / damaged)
    'cancelled',         -- customer or system cancelled before fulfillment
    'expired'            -- 24h passed while ready_for_pickup
  ));

alter table public.hold_requests
  add column if not exists in_progress_by    uuid references public.users(id) on delete set null,
  add column if not exists in_progress_at    timestamptz,
  add column if not exists cannot_fulfill_reason text,
  add column if not exists cannot_fulfilled_at   timestamptz,
  add column if not exists cannot_fulfilled_by   uuid references public.users(id) on delete set null,
  add column if not exists notify_channel     text
    check (notify_channel in ('sms','email','both') or notify_channel is null),
  add column if not exists customer_notified_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Virtual cart — ephemeral "considering" list, separate from Saved
-- ---------------------------------------------------------------------------

create table if not exists public.cart_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  store_id     uuid not null references public.stores(id) on delete cascade,
  item_id      uuid not null references public.inventory(id) on delete cascade,
  quantity     int not null default 1 check (quantity between 1 and 50),
  added_at     timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists cart_items_user_idx on public.cart_items(user_id, added_at desc);

alter table public.cart_items enable row level security;

drop policy if exists cart_select on public.cart_items;
create policy cart_select on public.cart_items
  for select to authenticated using (user_id = auth.uid());

drop policy if exists cart_insert on public.cart_items;
create policy cart_insert on public.cart_items
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists cart_update on public.cart_items;
create policy cart_update on public.cart_items
  for update to authenticated using (user_id = auth.uid());

drop policy if exists cart_delete on public.cart_items;
create policy cart_delete on public.cart_items
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Cart RPCs (toggle-style so one tap does the right thing)
-- ---------------------------------------------------------------------------

create or replace function public.add_to_cart(p_item_id uuid, p_quantity int default 1)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item    record;
begin
  if v_user_id is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 then p_quantity := 1; end if;
  if p_quantity > 50 then raise exception 'quantity too large' using errcode = '22023'; end if;

  select id, store_id into v_item
  from public.inventory where id = p_item_id and is_active = true;

  if v_item is null then
    raise exception 'item not available' using errcode = '22023';
  end if;

  insert into public.cart_items (user_id, store_id, item_id, quantity)
  values (v_user_id, v_item.store_id, p_item_id, p_quantity)
  on conflict (user_id, item_id) do update
    set quantity = excluded.quantity, added_at = now();

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.add_to_cart(uuid, int) to authenticated;

create or replace function public.remove_from_cart(p_item_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;
  delete from public.cart_items
  where user_id = auth.uid() and item_id = p_item_id;
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.remove_from_cart(uuid) to authenticated;

create or replace function public.my_cart()
returns table (
  id uuid,
  item_id uuid,
  quantity int,
  added_at timestamptz,
  name text,
  brand text,
  price numeric,
  stock_qty int,
  image_url text,
  description_short text,
  store_id uuid,
  store_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ci.id, ci.item_id, ci.quantity, ci.added_at,
    inv.name, inv.brand, inv.price, inv.stock_qty, inv.image_url,
    inv.description_short,
    ci.store_id, st.name as store_name
  from public.cart_items ci
  join public.inventory inv on inv.id = ci.item_id
  join public.stores st on st.id = ci.store_id
  where ci.user_id = auth.uid()
  order by ci.added_at desc;
$$;

grant execute on function public.my_cart() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Enhanced customer hold request — captures notify preference
-- ---------------------------------------------------------------------------

create or replace function public.request_hold_v2(
  p_item_id       uuid,
  p_notify_channel text,   -- 'sms' | 'email' | 'both'
  p_phone         text default null,
  p_email         text default null,
  p_quantity      int default 1,
  p_notes         text default null
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

  return json_build_object(
    'hold_id', v_hold_id,
    'item_name', v_item.name,
    'price', v_item.price,
    'quantity', p_quantity
  );
end;
$$;

grant execute on function public.request_hold_v2(uuid, text, text, text, int, text) to authenticated;
