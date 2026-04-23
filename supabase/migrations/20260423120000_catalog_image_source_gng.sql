-- Allow catalog_products.image_source = 'grapes_and_grains' so the
-- scrape-grapes-and-grains.ts pipeline can tag images it harvests from
-- the City Hive storefront at grapesandgrains.com.
--
-- Keeps per-retailer attribution so the storefront UI can show
-- "Image · Grapes & Grains" (matching the pattern already used for
-- wikipedia / openfoodfacts sources on public_inventory).
--
-- When we productize the City Hive scraper to hit additional retailers,
-- we'll either add more values here or refactor to a reference table.

alter table public.catalog_products
  drop constraint if exists catalog_products_image_source_check;

alter table public.catalog_products
  add constraint catalog_products_image_source_check
  check (image_source in (
    'pos',
    'upc_api',
    'staff_upload',
    'crowdsourced',
    'placeholder',
    'grapes_and_grains'
  ));
