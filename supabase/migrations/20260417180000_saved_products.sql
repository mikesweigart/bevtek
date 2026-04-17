-- Saved products ("favorites") — customers and employees can bookmark
-- SKUs they find interesting. Shows up on the mobile Saved tab.
--
-- Separate table (not a boolean on inventory) because the same product
-- in one store's catalog can be saved by many users, and we want a
-- saved_at timestamp for "recently saved" ordering plus optional notes.

create table if not exists public.saved_products (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  store_id      uuid not null references public.stores(id) on delete cascade,
  item_id       uuid not null references public.inventory(id) on delete cascade,
  notes         text,
  saved_at      timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists saved_products_user_idx  on public.saved_products(user_id, saved_at desc);
create index if not exists saved_products_store_idx on public.saved_products(store_id, saved_at desc);

alter table public.saved_products enable row level security;

-- Users only see their own saves. Employees see their own saves too
-- (not a shared team list — the team wants their personal picks).
drop policy if exists saved_select on public.saved_products;
create policy saved_select on public.saved_products
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists saved_insert on public.saved_products;
create policy saved_insert on public.saved_products
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists saved_delete on public.saved_products;
create policy saved_delete on public.saved_products
  for delete to authenticated
  using (user_id = auth.uid());

-- RPC that toggles a save. Handy one-call round-trip from mobile.
create or replace function public.toggle_save(p_item_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item    record;
  v_existing uuid;
begin
  if v_user_id is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  select id, store_id into v_item
  from public.inventory
  where id = p_item_id and is_active = true;

  if v_item is null then
    raise exception 'item not available' using errcode = '22023';
  end if;

  select id into v_existing from public.saved_products
  where user_id = v_user_id and item_id = p_item_id;

  if v_existing is not null then
    delete from public.saved_products where id = v_existing;
    return json_build_object('saved', false);
  end if;

  insert into public.saved_products (user_id, store_id, item_id)
  values (v_user_id, v_item.store_id, p_item_id);

  return json_build_object('saved', true);
end;
$$;

grant execute on function public.toggle_save(uuid) to authenticated;

-- Convenience: list my saves joined with inventory details.
create or replace function public.my_saved_products()
returns table (
  id uuid,
  item_id uuid,
  saved_at timestamptz,
  notes text,
  name text,
  brand text,
  price numeric,
  stock_qty int,
  image_url text,
  description_short text,
  flavor_notes text,
  tasting_notes text,
  store_id uuid,
  store_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    sp.id,
    sp.item_id,
    sp.saved_at,
    sp.notes,
    inv.name,
    inv.brand,
    inv.price,
    inv.stock_qty,
    inv.image_url,
    inv.description_short,
    inv.flavor_notes,
    inv.tasting_notes,
    sp.store_id,
    st.name as store_name
  from public.saved_products sp
  join public.inventory inv on inv.id = sp.item_id
  join public.stores st on st.id = sp.store_id
  where sp.user_id = auth.uid()
  order by sp.saved_at desc;
$$;

grant execute on function public.my_saved_products() to authenticated;
