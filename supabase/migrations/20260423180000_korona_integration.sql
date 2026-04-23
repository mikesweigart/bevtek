-- =============================================================================
-- Korona Cloud POS integration — store config + sync audit
-- =============================================================================
--
-- Korona doesn't push — it's pull-only via REST. We run a nightly cron job
-- per store that calls their /products endpoint, diffs against `inventory`,
-- and upserts rows. This migration adds two additive tables:
--
--   1. `store_integrations` — opaque per-provider config rows. Holds the
--      Korona API credentials (`account`, `username`, `password`) as a
--      jsonb blob. Isolated from `stores` so the config can have its own
--      strict RLS without entangling column grants on the heavily-used
--      stores table. Owner-only read; service-role only write.
--
--   2. `pos_sync_runs` — audit trail for each sync attempt, so /admin/health
--      and the store's own billing page can answer "did the Korona sync run
--      last night, and how many SKUs changed?". One row per store per night;
--      volume stays tiny.
--
-- Why a separate table for config instead of a `stores.korona_config` column:
--   - `stores` is read across the app with existing RLS that lets managers
--     (and sometimes staff) see the row. Adding secrets to that row risks
--     leakage the moment someone adds a new SELECT path.
--   - Column-level grants on `stores` are fragile — every future migration
--     that adds a column has to remember to re-grant it, and missing one
--     breaks existing queries.
--   - Separating the secrets gives us a single narrowly-scoped RLS policy
--     (`store_integrations_select_owner`) that we can reason about directly.
--
-- When the table doesn't yet exist (e.g. a developer on an old branch),
-- `getKoronaConfig()` in lib/korona/client.ts returns null and sync is a
-- no-op — matches the fail-closed pattern used elsewhere in the codebase.

-- -----------------------------------------------------------------------------
-- store_integrations — per-provider opaque config, owner-only read
-- -----------------------------------------------------------------------------

create table if not exists public.store_integrations (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  provider     text not null check (provider in ('korona','lightspeed','mpower','bottle_pos')),
  -- Shape depends on provider. For Korona: { account, username, password, base_url? }
  -- Never expose this column to anon; only owner-role authenticated users
  -- see it through the SELECT policy below, and even then they see the
  -- full password. Consider encrypting at the app layer before storing if
  -- regulatory compliance requires it (PCI isn't in scope today since
  -- Korona credentials aren't cardholder data).
  config       jsonb not null default '{}'::jsonb,
  enabled      boolean not null default true,
  last_sync_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, provider)
);

create index if not exists store_integrations_store_idx
  on public.store_integrations(store_id, provider)
  where enabled = true;

alter table public.store_integrations enable row level security;

-- Owner-only read. Managers intentionally excluded — seeing the shape of
-- the integration config is an operator-level concern. Staff never see it.
create policy store_integrations_select_owner on public.store_integrations
  for select to authenticated
  using (
    store_id = public.current_store_id()
    and public.current_user_role() = 'owner'
  );

-- No INSERT/UPDATE/DELETE policy — service-role writes only. Setup flows
-- through a server action (forthcoming) that verifies the caller is owner
-- and uses the service client to insert.

-- Updated-at trigger to match the app-wide convention.
create trigger store_integrations_updated_at
  before update on public.store_integrations
  for each row execute function public.set_updated_at();

comment on table public.store_integrations is
  'Per-provider integration config. Jsonb blob shape is provider-specific; read by service-role and (for owners) via RLS. Never expose through public views.';

-- -----------------------------------------------------------------------------
-- pos_sync_runs — one row per sync attempt
-- -----------------------------------------------------------------------------
create table if not exists public.pos_sync_runs (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  provider        text not null check (provider in ('korona','lightspeed','mpower','bottle_pos')),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'running'
    check (status in ('running','ok','partial','failed')),
  rows_scanned    integer not null default 0,
  rows_upserted   integer not null default 0,
  rows_skipped    integer not null default 0,
  rows_failed     integer not null default 0,
  error_message   text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists pos_sync_runs_store_idx
  on public.pos_sync_runs(store_id, started_at desc);
create index if not exists pos_sync_runs_status_idx
  on public.pos_sync_runs(status, started_at desc)
  where status in ('failed','partial');

alter table public.pos_sync_runs enable row level security;

-- Owners/managers see their own store's history (for a billing/support view).
create policy pos_sync_runs_select on public.pos_sync_runs
  for select to authenticated
  using (
    store_id = public.current_store_id()
    and public.current_user_role() in ('owner','manager')
  );

-- Writes are service-role only (cron + background jobs). No INSERT/UPDATE
-- policy means authenticated clients cannot write.

comment on table public.pos_sync_runs is
  'Audit trail for POS sync attempts. Cron writes one row per run per store, flipping status to ok/partial/failed on completion.';

-- =============================================================================
-- Done. The Korona client (apps/web/lib/korona/*) drives reads; cron route
-- /api/cron/korona-sync writes rows. No direct SQL from app code.
-- =============================================================================
