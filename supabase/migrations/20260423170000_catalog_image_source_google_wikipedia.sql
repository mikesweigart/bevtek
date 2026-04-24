-- Allow catalog_products.image_source = 'google_search' and 'wikipedia' so
-- the fetch-google-images.ts and fetch-wikipedia-images.ts pipelines can
-- tag images they harvest from those sources.
--
-- BUG FIX: fetch-google-images.ts was already writing image_source =
-- 'google_search' but the constraint in 20260422000000_master_catalog.sql
-- never allowed that value. Any prior `pnpm google-images -- --write` run
-- would have failed with a CHECK-constraint violation — which is why the
-- constraint's absence went unnoticed (the script was never successfully
-- run in write mode).
--
-- Once we have 3-4 more retailers we should refactor image_source to a
-- reference table (catalog_image_sources) so new sources don't require
-- CHECK constraint churn — but we're still early enough that the enum
-- semantics are useful documentation.

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
    'liquor_barn',
    'google_search',
    'wikipedia'
  ));
