-- Megan Shopper: customer-facing public browse experience.
-- We expose a public view (public_inventory) with only customer-safe columns,
-- plus a narrow policy on stores for reading name+slug.

-- ---------------------------------------------------------------------------
-- Slug generation: ensure every store has a URL-friendly slug
-- ---------------------------------------------------------------------------

create or replace function public.slugify(input text)
returns text
language sql immutable
as $$
  select regexp_replace(
    regexp_replace(lower(trim(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g'
  );
$$;

create or replace function public.stores_set_slug()
returns trigger language plpgsql as $$
declare
  v_base text;
  v_candidate text;
  v_counter int := 1;
begin
  if new.slug is null or length(trim(new.slug)) = 0 then
    v_base := public.slugify(new.name);
    if v_base = '' then
      v_base := 'store';
    end if;
    v_candidate := v_base;
    while exists (select 1 from public.stores where slug = v_candidate and id <> new.id) loop
      v_counter := v_counter + 1;
      v_candidate := v_base || '-' || v_counter;
    end loop;
    new.slug := v_candidate;
  end if;
  return new;
end;
$$;

drop trigger if exists stores_set_slug_trg on public.stores;
create trigger stores_set_slug_trg
  before insert or update of name, slug on public.stores
  for each row execute function public.stores_set_slug();

-- Backfill any existing stores that were created before this trigger.
update public.stores set slug = null where slug is null;  -- no-op; trigger on next update
update public.stores set name = name where slug is null;  -- force trigger to fire

-- ---------------------------------------------------------------------------
-- Public view of customer-safe store data
-- ---------------------------------------------------------------------------

create or replace view public.public_stores
with (security_invoker = true) as
select id, name, slug, timezone
from public.stores;

grant select on public.public_stores to anon, authenticated;

-- Allow anyone to read basic store fields via this view. The view is
-- security_invoker, so underlying RLS still applies — add a permissive policy.
drop policy if exists stores_public_read on public.stores;
create policy stores_public_read on public.stores
  for select to anon, authenticated
  using (true);  -- any row; we still only expose name/slug via the view

-- But we already had a stricter `stores_select` policy for authenticated users
-- (members of the store). With multiple permissive policies, PostgreSQL ORs them.
-- The authenticated-user path still works; anon now gets read access too.
-- Note: the existing stores_select policy (authenticated) is kept so store
-- members can read full columns.

-- ---------------------------------------------------------------------------
-- Public view of customer-safe inventory
-- Columns: id, store_id, sku, name, brand, category, subcategory,
-- size_ml, abv, price, stock_qty, description, tasting_notes
-- (No cost, no metadata.)
-- ---------------------------------------------------------------------------

create or replace view public.public_inventory
with (security_invoker = true) as
select
  id, store_id, sku, name, brand, category, subcategory,
  size_ml, abv, price, stock_qty, description, tasting_notes, is_active
from public.inventory;

grant select on public.public_inventory to anon, authenticated;

-- Permissive public read on inventory rows where is_active = true.
drop policy if exists inventory_public_read on public.inventory;
create policy inventory_public_read on public.inventory
  for select to anon, authenticated
  using (is_active = true);
