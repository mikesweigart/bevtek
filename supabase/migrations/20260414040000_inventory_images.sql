-- Add image support to inventory
alter table public.inventory
  add column if not exists image_url text;

-- Update the public view to expose the image.
create or replace view public.public_inventory
with (security_invoker = true) as
select
  id, store_id, sku, name, brand, category, subcategory,
  size_ml, abv, price, stock_qty, description, tasting_notes,
  image_url, is_active
from public.inventory;

grant select on public.public_inventory to anon, authenticated;
