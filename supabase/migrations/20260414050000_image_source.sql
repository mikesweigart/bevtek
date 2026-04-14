-- Track where each image came from, so the UI can show appropriate attribution.
-- Values: 'manual' (owner set), 'import' (came from spreadsheet), 'wikipedia' (auto-enriched).
alter table public.inventory
  add column if not exists image_source text;

create or replace view public.public_inventory
with (security_invoker = true) as
select
  id, store_id, sku, name, brand, category, subcategory,
  size_ml, abv, price, stock_qty, description, tasting_notes,
  image_url, image_source, is_active
from public.inventory;

grant select on public.public_inventory to anon, authenticated;
