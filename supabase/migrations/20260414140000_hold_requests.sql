-- Hold requests — customer asks staff to set aside an item for later pickup.
-- Triggered from: Megan Shopper ("Hold this for me"), Megan Receptionist
-- (phone orders), in-store, or manual entry.

create table if not exists public.hold_requests (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  item_id         uuid references public.inventory(id) on delete set null,
  item_snapshot   jsonb not null default '{}'::jsonb,  -- store name/sku at time of request
  customer_name   text not null,
  customer_phone  text,
  customer_email  text,
  quantity        int not null default 1 check (quantity > 0),
  notes           text,
  status          text not null default 'pending'
    check (status in ('pending','confirmed','picked_up','cancelled','expired')),
  source          text not null default 'shopper'
    check (source in ('shopper','phone','in_store','manual')),
  hold_until      timestamptz not null default (now() + interval '24 hours'),
  confirmed_by    uuid references public.users(id) on delete set null,
  confirmed_at    timestamptz,
  picked_up_at    timestamptz,
  cancelled_at    timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index hold_requests_store_idx on public.hold_requests(store_id, created_at desc);
create index hold_requests_status_idx on public.hold_requests(store_id, status);
create index hold_requests_item_idx on public.hold_requests(item_id);

alter table public.hold_requests enable row level security;

-- Store members see all holds for their store.
create policy holds_select on public.hold_requests
  for select to authenticated
  using (store_id = public.current_store_id());

-- Staff+ can update (confirm, cancel, mark picked up).
create policy holds_update on public.hold_requests
  for update to authenticated
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- ---------------------------------------------------------------------------
-- Public RPC: customer creates a hold from the shopper storefront
-- ---------------------------------------------------------------------------

create or replace function public.request_hold(
  p_store_slug     text,
  p_item_id        uuid,
  p_customer_name  text,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_quantity       int default 1,
  p_notes          text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id  uuid;
  v_item      record;
  v_hold_id   uuid;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'name is required' using errcode = '22023';
  end if;
  if (p_customer_phone is null or length(trim(p_customer_phone)) = 0)
     and (p_customer_email is null or length(trim(p_customer_email)) = 0) then
    raise exception 'phone or email is required' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;
  if p_quantity > 50 then
    raise exception 'quantity too large' using errcode = '22023';
  end if;

  -- Resolve the store by slug.
  select id into v_store_id
  from public.stores where slug = p_store_slug;
  if v_store_id is null then
    raise exception 'store not found' using errcode = '22023';
  end if;

  -- Item must belong to this store and be active.
  select id, name, brand, price, sku, stock_qty
    into v_item
  from public.inventory
  where id = p_item_id and store_id = v_store_id and is_active = true;
  if v_item is null then
    raise exception 'item not available' using errcode = '22023';
  end if;

  insert into public.hold_requests (
    store_id, item_id, item_snapshot,
    customer_name, customer_phone, customer_email,
    quantity, notes, source
  ) values (
    v_store_id, v_item.id,
    json_build_object(
      'name', v_item.name,
      'brand', v_item.brand,
      'sku', v_item.sku,
      'price', v_item.price,
      'stock_at_request', v_item.stock_qty
    ),
    trim(p_customer_name),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    nullif(trim(coalesce(p_customer_email, '')), ''),
    p_quantity,
    nullif(trim(coalesce(p_notes, '')), ''),
    'shopper'
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

revoke all on function public.request_hold(text, uuid, text, text, text, int, text) from public;
grant execute on function public.request_hold(text, uuid, text, text, text, int, text) to anon, authenticated;
