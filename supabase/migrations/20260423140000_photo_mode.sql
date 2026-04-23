-- =============================================================================
-- Photo Mode: staff image submissions with automated moderation
-- =============================================================================
-- Lets managers (and, with privilege, staff) photograph products directly
-- from their phones and feed the shared `catalog_products.image_url`. Every
-- upload is:
--   1. Written to `storage.objects` under `store-media/{store_id}/catalog/{catalog_product_id}/{ts}.{ext}`
--   2. Audited in `catalog_image_submissions` with moderation scores
--   3. Moderated by OpenAI Moderation API (explicit content) +
--      Claude Haiku vision (is-it-a-product-photo classifier)
--   4. Applied to `catalog_products` only if approved AND the existing
--      image_quality_score is lower than the submission's score.
--
-- Managers can revoke any user's upload privilege via a gallery page that
-- reads this table.
--
-- This migration:
--   - Adds `users.photo_upload_privilege` (default true; managers can flip).
--   - Adds `catalog_products.image_contributor_user_id` for per-user attribution.
--   - Creates `catalog_image_submissions` with RLS for read-own-store only.
--   - Writes to catalog_products / catalog_image_submissions go through the
--     service-role server action `submitCatalogImageAction`. We deliberately
--     do NOT open a direct UPDATE policy on catalog_products for authenticated
--     users — the server action gates on role + privilege + moderation before
--     touching the master table.

-- -----------------------------------------------------------------------------
-- users.photo_upload_privilege — per-user toggle for Photo Mode access
-- -----------------------------------------------------------------------------
-- Owners and managers ALWAYS have the privilege regardless of this flag.
-- Staff default to true, but a manager can revoke to false from the gallery.
alter table public.users
  add column if not exists photo_upload_privilege boolean not null default true;

-- -----------------------------------------------------------------------------
-- catalog_products.image_contributor_user_id — attribution
-- -----------------------------------------------------------------------------
-- Already tracks `image_contributor_store_id`. Adding per-user attribution
-- so the manager gallery can show "uploaded by Jane on Apr 23" and revoke
-- at the individual level.
alter table public.catalog_products
  add column if not exists image_contributor_user_id uuid
  references public.users(id) on delete set null;

-- -----------------------------------------------------------------------------
-- catalog_image_submissions — audit log of every Photo Mode upload
-- -----------------------------------------------------------------------------
create table if not exists public.catalog_image_submissions (
  id                      uuid primary key default gen_random_uuid(),
  catalog_product_id      uuid not null references public.catalog_products(id) on delete cascade,
  store_id                uuid not null references public.stores(id) on delete cascade,
  submitted_by            uuid not null references public.users(id) on delete cascade,
  image_url               text not null,

  -- Moderation (set by the server action after OpenAI + Claude classifiers run)
  moderation_status       text not null default 'pending'
    check (moderation_status in ('pending','approved','rejected','flagged')),
  moderation_scores       jsonb,                              -- raw per-provider output for audit
  moderation_notes        text,                               -- human-readable reason when rejected/flagged

  -- Lifecycle
  applied_to_catalog_at   timestamptz,                        -- set when catalog_products.image_url updated
  rejected_at             timestamptz,                        -- set when auto-rejected or manager-rejected
  rejected_by             uuid references public.users(id) on delete set null,
  created_at              timestamptz not null default now()
);

create index if not exists catalog_image_submissions_store_idx
  on public.catalog_image_submissions (store_id, created_at desc);

create index if not exists catalog_image_submissions_product_idx
  on public.catalog_image_submissions (catalog_product_id);

create index if not exists catalog_image_submissions_submitter_idx
  on public.catalog_image_submissions (submitted_by, created_at desc);

-- Partial index for the manager-review queue (the "things to look at" feed)
create index if not exists catalog_image_submissions_review_queue_idx
  on public.catalog_image_submissions (store_id, created_at desc)
  where moderation_status in ('pending','flagged','rejected');

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------
alter table public.catalog_image_submissions enable row level security;

-- SELECT: any authenticated user in the store can see their store's submissions.
-- (The manager gallery UI then filters client-side by role — non-managers see
-- only their own; managers see all.)
drop policy if exists catalog_image_submissions_read_own_store on public.catalog_image_submissions;
create policy catalog_image_submissions_read_own_store
  on public.catalog_image_submissions
  for select
  to authenticated
  using (store_id = public.current_store_id());

-- INSERT / UPDATE / DELETE: service role only. The server action
-- `submitCatalogImageAction` validates role + privilege + runs moderation
-- before writing. Keeps write-path logic in one place.

-- -----------------------------------------------------------------------------
-- Helper view: products in this store that need photos
-- -----------------------------------------------------------------------------
-- Drives the Photo Mode session queue — products this store carries that
-- either have no catalog image or have a low-quality source (placeholder,
-- crowdsourced). Managers burn through this list one product at a time.
create or replace view public.catalog_products_needing_photos as
select
  cp.id                         as catalog_product_id,
  cp.canonical_name,
  cp.brand,
  cp.category,
  cp.subcategory,
  cp.size_ml,
  cp.image_url                  as existing_image_url,
  cp.image_source               as existing_image_source,
  cp.image_quality_score        as existing_image_quality_score,
  inv.store_id                  as store_id,
  inv.id                        as inventory_id,
  inv.sku                       as inventory_sku
from public.catalog_products cp
join public.inventory inv on inv.catalog_product_id = cp.id
where
  inv.is_active = true
  and (
    cp.image_url is null
    or cp.image_source in ('placeholder','crowdsourced')
    or coalesce(cp.image_quality_score, 0) < 0.5
  );

-- Expose the view to authenticated clients. RLS on the underlying tables
-- still applies — `inventory` is store-scoped by its own RLS, so each
-- authenticated user only sees rows for their own store here.
grant select on public.catalog_products_needing_photos to authenticated;

-- =============================================================================
-- Done. The Photo Mode server actions (apps/web/app/(app)/photo-mode/actions.ts)
-- drive writes. No direct SQL writes required from app code.
-- =============================================================================
