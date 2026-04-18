-- Inventory CSV import + enrichment pipeline.
--
-- Adds the enrichment fields (image, tasting notes, reviews, source
-- confidence), a Gabby-ready view that guarantees no image-less or
-- notes-less product ever reaches the recommend endpoint, a shared
-- UPC → image cache so we don't refetch the same bottle for every
-- store, and the import_jobs table backing the upload progress UI.
--
-- Spec: docs/inventory-import-and-enrichment.md §5.1

-- ---------------------------------------------------------------------------
-- 1. Inventory enrichment columns
-- ---------------------------------------------------------------------------

alter table public.inventory
  add column if not exists upc                  text,
  add column if not exists size_label           text,
  add column if not exists summary_for_customer text,
  add column if not exists average_rating       numeric(3,2),
  add column if not exists review_count         int,
  add column if not exists review_summary       text,
  add column if not exists review_source        text,
  add column if not exists source_confidence    text
    check (source_confidence in
      ('verified','high','medium','low','partial','none')
      or source_confidence is null),
  add column if not exists enriched_at          timestamptz,
  add column if not exists enrichment_version   int not null default 0;

create index if not exists inventory_upc_idx
  on public.inventory(upc) where upc is not null;

create index if not exists inventory_enriched_idx
  on public.inventory(store_id, enriched_at)
  where enriched_at is not null;

-- ---------------------------------------------------------------------------
-- 2. Gabby-ready view — the single gate for recommendations
-- ---------------------------------------------------------------------------
--
-- Contract: every row here has a name, category, image, and ≥20 chars
-- of tasting notes. The recommend endpoint points at this view instead
-- of inventory directly so Gabby can never surface a bare / broken
-- product card.

create or replace view public.gabby_ready_inventory as
select *
from public.inventory
where is_active = true
  and stock_qty > 0
  and name is not null
  and category in ('wine','beer','spirits','mixer','garnish')
  and image_url is not null
  and tasting_notes is not null
  and length(trim(tasting_notes)) >= 20;

grant select on public.gabby_ready_inventory to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Shared UPC → image cache (cross-store)
-- ---------------------------------------------------------------------------
--
-- When store A uploads "Silver Oak 089832000012" and we fetch its
-- bottle photo, store B's next upload of the same UPC hits this cache
-- instantly. Keeps enrichment cost near-zero at scale.

create table if not exists public.product_image_cache (
  upc          text primary key,
  image_url    text not null,
  source       text not null,
  fetched_at   timestamptz not null default now()
);

-- Read-only for clients; writes happen server-side via service role.
alter table public.product_image_cache enable row level security;
drop policy if exists product_image_cache_read on public.product_image_cache;
create policy product_image_cache_read on public.product_image_cache
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4. Import jobs — backs the owner-facing progress UI
-- ---------------------------------------------------------------------------

create table if not exists public.import_jobs (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  uploaded_by    uuid references public.users(id) on delete set null,
  filename       text,
  status         text not null
    check (status in ('queued','validating','importing','enriching','done','failed')),
  total_rows     int,
  imported_rows  int not null default 0,
  enriched_rows  int not null default 0,
  skipped_rows   int not null default 0,
  errors_jsonb   jsonb not null default '[]'::jsonb,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists import_jobs_store_idx
  on public.import_jobs(store_id, created_at desc);

alter table public.import_jobs enable row level security;

-- Only owners/managers of the store can see their own import jobs.
drop policy if exists import_jobs_select on public.import_jobs;
create policy import_jobs_select on public.import_jobs
  for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.store_id = import_jobs.store_id
        and u.role in ('owner','manager')
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Helper: count gabby-ready items for a store (used by dashboard/UX copy)
-- ---------------------------------------------------------------------------

create or replace function public.gabby_ready_count(p_store_id uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.gabby_ready_inventory
  where store_id = p_store_id;
$$;

grant execute on function public.gabby_ready_count(uuid) to authenticated;
