-- =============================================================================
-- Master product catalog
-- =============================================================================
-- PREREQUISITE: this migration needs the public._migrations ledger to exist
-- (created by 20260418230000_migration_tracking.sql). On systems where prior
-- migrations were applied via the SQL Editor instead of apply-migration.ts,
-- the ledger may not have been created yet. Guard it with `if not exists`
-- so this migration can seed the ledger on such systems and still be safe
-- to re-run anywhere else.
create table if not exists public._migrations (
  id              bigserial primary key,
  filename        text not null unique,
  sha256          text not null,
  applied_at      timestamptz not null default now(),
  applied_by      text not null default 'script',
  duration_ms     integer,
  notes           text
);
alter table public._migrations enable row level security;
-- No policies on _migrations = service role only. Intentional.

-- Introduces `public.catalog_products`: a shared, cross-store registry of
-- real-world SKUs. One row per unique beverage (identified by UPC when
-- available, otherwise by a brand+name+size fingerprint). Each store's
-- `inventory` row points at its catalog_product, so that when Store A's
-- staff uploads a photo of Buffalo Trace 750ml, every other BevTek store
-- selling the same SKU inherits it.
--
-- Also introduces `public.product_reviews`: user-generated reviews that
-- live at the catalog level, so a product's accumulated social proof
-- follows it across stores. Per the product decision, reviews are
-- GLOBALLY VISIBLE to authenticated users — a shopper at Store B reads
-- the same Buffalo Trace reviews a shopper at Store A does. The
-- `store_id` is kept on each review row for attribution (so the UI can
-- show "Reviewed at The Wine Cellar" next to the body) and for future
-- per-store filtering if a store ever wants to hide third-party text.
-- Aggregate rating is still exposed via a SECURITY DEFINER function
-- `public.catalog_product_rating(uuid)` as a convenience API for the
-- recommender path.
--
-- Resolution pattern (for Gabby and the shopper UI):
--   image_url       := coalesce(inventory.image_url, catalog_products.image_url)
--   tasting_notes   := coalesce(inventory.tasting_notes, catalog_products.tasting_notes)
--   style[]         := coalesce(nullif(inventory.style, '{}'), catalog_products.style)
--   (and so on — store-level value wins, catalog is the fallback)
--
-- The catalog-build script (scripts/build-catalog-products.ts) populates
-- these tables from existing inventory after this migration lands.

-- -----------------------------------------------------------------------------
-- catalog_products — the master registry
-- -----------------------------------------------------------------------------
create table if not exists public.catalog_products (
  id                          uuid primary key default gen_random_uuid(),

  -- Identity
  upc                         text,
  fingerprint                 text not null,             -- brand+name+size+pack hash, computed in app code
  canonical_name              text not null,
  brand                       text,
  category                    text not null check (category in ('wine','beer','spirits','mixer','garnish')),
  subcategory                 text,
  varietal                    text,
  size_ml                     integer check (size_ml is null or size_ml > 0),
  pack_count                  integer not null default 1 check (pack_count >= 1),

  -- Images
  image_url                   text,                       -- primary image (what shows in the grid)
  image_urls                  text[],                     -- alternate angles, label close-ups, etc.
  image_source                text check (image_source in ('pos','upc_api','staff_upload','crowdsourced','placeholder')),
  image_contributor_store_id  uuid references public.stores(id) on delete set null,
  image_quality_score         numeric default 0,          -- for ranking when multiple contributors exist

  -- Enrichment (copied over from inventory at catalog-build time;
  -- store-level inventory rows can override but default to these)
  tasting_notes               text,
  style                       text[],
  flavor_profile              text[],
  intended_use                text[],
  body                        text,
  sweetness                   text,
  hop_level                   text,
  abv                         numeric,

  -- Provenance / audit
  enrichment_version          integer default 2,
  enriched_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- UPC is the preferred identifier when available; unique so the
-- catalog-builder can upsert deterministically.
create unique index if not exists catalog_products_upc_unique
  on public.catalog_products (upc)
  where upc is not null;

-- Fingerprint is the fallback identity; every row has one.
create unique index if not exists catalog_products_fingerprint_unique
  on public.catalog_products (fingerprint);

-- Common filter paths for Gabby's recommender.
create index if not exists catalog_products_category_idx on public.catalog_products (category);
create index if not exists catalog_products_brand_idx on public.catalog_products (brand);

-- updated_at trigger (reuse existing function)
drop trigger if exists catalog_products_touch on public.catalog_products;
create trigger catalog_products_touch
  before update on public.catalog_products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- inventory.catalog_product_id — FK from per-store inventory to the master row
-- -----------------------------------------------------------------------------
-- Nullable during migration: rows that can't be confidently matched to a
-- catalog entry (rare fingerprints, typos) stay NULL and still function
-- exactly as before. The catalog-build script sets this column as it
-- creates / matches catalog_products rows.
alter table public.inventory
  add column if not exists catalog_product_id uuid
  references public.catalog_products(id) on delete set null;

create index if not exists inventory_catalog_product_idx
  on public.inventory (catalog_product_id)
  where catalog_product_id is not null;

-- -----------------------------------------------------------------------------
-- product_reviews — user-generated reviews, catalog-keyed
-- -----------------------------------------------------------------------------
create table if not exists public.product_reviews (
  id                  uuid primary key default gen_random_uuid(),
  catalog_product_id  uuid not null references public.catalog_products(id) on delete cascade,
  store_id            uuid not null references public.stores(id) on delete cascade,
  user_id             uuid references auth.users(id) on delete set null,   -- null = anonymous
  rating              integer not null check (rating between 1 and 5),
  body                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists product_reviews_catalog_idx on public.product_reviews (catalog_product_id);
create index if not exists product_reviews_store_idx   on public.product_reviews (store_id);
create index if not exists product_reviews_user_idx
  on public.product_reviews (user_id)
  where user_id is not null;

drop trigger if exists product_reviews_touch on public.product_reviews;
create trigger product_reviews_touch
  before update on public.product_reviews
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Aggregate rating — exposed via SECURITY DEFINER so stores can read
-- cross-store averages without being able to SELECT foreign review text.
-- -----------------------------------------------------------------------------
create or replace function public.catalog_product_rating(p_catalog_product_id uuid)
returns table (review_count integer, avg_rating numeric)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::integer as review_count,
    coalesce(avg(rating)::numeric(3,2), 0) as avg_rating
  from public.product_reviews
  where catalog_product_id = p_catalog_product_id;
$$;

grant execute on function public.catalog_product_rating(uuid) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------
alter table public.catalog_products enable row level security;
alter table public.product_reviews  enable row level security;

-- ---- catalog_products ----
-- SELECT: globally readable (this is shared data — it's the whole point).
drop policy if exists catalog_products_read_all on public.catalog_products;
create policy catalog_products_read_all
  on public.catalog_products
  for select
  using (true);

-- INSERT / UPDATE / DELETE: no policies = locked to service_role.
-- The catalog-build script runs with the service-role key and bypasses
-- RLS. A future staff-upload flow will add a specific INSERT/UPDATE
-- policy gated on role='owner' or role='manager'.

-- ---- product_reviews ----
-- SELECT: globally readable by authenticated users. Review text is
-- shared across all stores so a product's social proof compounds
-- network-wide. The `store_id` column stays on each row so the UI can
-- attribute reviews ("Reviewed at The Wine Cellar") and so we can
-- filter per-store later if needed.
drop policy if exists product_reviews_read_all_authenticated on public.product_reviews;
create policy product_reviews_read_all_authenticated
  on public.product_reviews
  for select
  to authenticated
  using (true);

-- Shoppers (anon) reading reviews at a store's storefront is handled
-- separately — when the shopper UI starts pulling reviews we'll add a
-- policy following the pattern in 20260414030000_shopper_public_access.

-- INSERT: a user can leave a review for their store, attributed to
-- themselves.
drop policy if exists product_reviews_insert_own on public.product_reviews;
create policy product_reviews_insert_own
  on public.product_reviews
  for insert
  with check (
    store_id = public.current_store_id()
    and (user_id is null or user_id = auth.uid())
  );

-- UPDATE / DELETE: only the review's author can change their own row.
drop policy if exists product_reviews_update_own on public.product_reviews;
create policy product_reviews_update_own
  on public.product_reviews
  for update
  using (user_id = auth.uid());

drop policy if exists product_reviews_delete_own on public.product_reviews;
create policy product_reviews_delete_own
  on public.product_reviews
  for delete
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Done. The catalog-build script populates these tables next.
-- -----------------------------------------------------------------------------
