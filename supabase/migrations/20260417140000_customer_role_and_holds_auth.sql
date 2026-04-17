-- Customer role + authenticated customer holds
-- --------------------------------------------------
-- Context: adds a 'customer' role to public.users so that customers can
-- sign up in the mobile app / shopper web and get a persistent identity
-- (save holds, see history, get push notifications). Existing anonymous
-- holds (via request_hold RPC by slug + name/phone) continue to work.

-- 1. Allow 'customer' role on public.users
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('owner','manager','staff','customer'));

-- 2. Link holds to authenticated customer accounts (optional — still supports anonymous)
alter table public.hold_requests
  add column if not exists customer_user_id uuid references public.users(id) on delete set null;

create index if not exists hold_requests_customer_idx
  on public.hold_requests(customer_user_id, created_at desc);

-- 3. RLS: customers can see their own holds (across any store)
--    Staff/owner/manager continue to see all holds for their store.
drop policy if exists holds_select on public.hold_requests;
create policy holds_select on public.hold_requests
  for select to authenticated
  using (
    -- Employees see all holds for their store
    (store_id = public.current_store_id()
      and public.current_user_role() in ('owner','manager','staff'))
    OR
    -- Customers see only their own holds
    (customer_user_id = auth.uid())
  );

-- 4. Authenticated customer creates a hold (uses their logged-in identity)
create or replace function public.request_hold_authed(
  p_item_id   uuid,
  p_quantity  int default 1,
  p_notes     text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       record;
  v_item       record;
  v_hold_id    uuid;
begin
  -- Pull the authenticated user
  select id, store_id, email, full_name, role
    into v_user
  from public.users
  where id = auth.uid();

  if v_user is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 then p_quantity := 1; end if;
  if p_quantity > 50 then raise exception 'quantity too large' using errcode = '22023'; end if;

  -- Item must be active in some store (item.store_id wins over user.store_id
  -- because customers may browse multiple stores).
  select id, name, brand, price, sku, stock_qty, store_id
    into v_item
  from public.inventory
  where id = p_item_id and is_active = true;

  if v_item is null then
    raise exception 'item not available' using errcode = '22023';
  end if;

  insert into public.hold_requests (
    store_id, item_id, item_snapshot,
    customer_name, customer_email, customer_user_id,
    quantity, notes, source
  ) values (
    v_item.store_id, v_item.id,
    json_build_object(
      'name', v_item.name,
      'brand', v_item.brand,
      'sku', v_item.sku,
      'price', v_item.price,
      'stock_at_request', v_item.stock_qty
    ),
    coalesce(v_user.full_name, split_part(v_user.email, '@', 1)),
    v_user.email,
    v_user.id,
    p_quantity,
    nullif(trim(coalesce(p_notes, '')), ''),
    case when v_user.role = 'customer' then 'shopper' else 'in_store' end
  )
  returning id into v_hold_id;

  return json_build_object(
    'hold_id', v_hold_id,
    'item_name', v_item.name,
    'price', v_item.price,
    'quantity', p_quantity,
    'store_id', v_item.store_id
  );
end;
$$;

grant execute on function public.request_hold_authed(uuid, int, text) to authenticated;

-- 5. Customer signup helper — claims an auth user as a customer of a store.
--    Called once after a customer signs up through the mobile app or shopper web.
create or replace function public.claim_customer_profile(
  p_store_slug text,
  p_full_name  text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_email    text;
begin
  if auth.uid() is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  select id into v_store_id from public.stores where slug = p_store_slug;
  if v_store_id is null then
    raise exception 'store not found' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.users (id, store_id, email, full_name, role)
  values (auth.uid(), v_store_id, v_email,
          nullif(trim(coalesce(p_full_name, '')), ''), 'customer')
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.users.full_name),
    -- Never downgrade an employee to a customer
    role = case
      when public.users.role in ('owner','manager','staff') then public.users.role
      else 'customer'
    end;

  return json_build_object('ok', true, 'store_id', v_store_id);
end;
$$;

grant execute on function public.claim_customer_profile(text, text) to authenticated;

-- 6. Convenience: list holds for the signed-in customer
create or replace function public.my_holds() returns setof public.hold_requests
language sql
security definer
set search_path = public
stable
as $$
  select * from public.hold_requests
  where customer_user_id = auth.uid()
  order by created_at desc;
$$;

grant execute on function public.my_holds() to authenticated;
