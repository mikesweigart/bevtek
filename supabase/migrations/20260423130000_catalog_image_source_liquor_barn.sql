-- Allow catalog_products.image_source = 'liquor_barn' so the
-- scrape-liquor-barn.ts pipeline can tag images it harvests from the
-- Liquor Barn City Hive storefront at liquorbarn.com (Louisville, KY).
--
-- Second retailer added via the productized scripts/lib/cityhive-scraper
-- pipeline — adding any additional City Hive storefront is now a 3-file
-- change: this migration, a scripts/scrape-<retailer>.ts thin wrapper, and
-- a package.json script entry.
--
-- Once we have 3-4 more retailers we should refactor to a reference table
-- (catalog_image_sources) so new retailers don't require CHECK constraint
-- churn — but for now this keeps the self-documenting enum semantics.

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
    'grapes_and_grains',
    'liquor_barn'
  ));
