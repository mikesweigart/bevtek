-- =============================================================================
-- feature_flags — per-store key/value flag table for gradual rollouts
-- =============================================================================
-- Use cases:
--   * Gating newly-shipped surfaces behind a switch we can flip per-store
--     (e.g. "update_inventory_details_edit" for the description/tasting-
--     notes panel inside the Update Inventory session).
--   * A/B testing ("homepage_hero_variant") without a code deploy.
--   * Kill-switches for integrations that are misbehaving for one customer
--     ("disable_retell_inbound" = true while we debug their IVR).
--
-- Defaults live in code, not DB: apps/web/lib/flags.ts returns a hardcoded
-- default when a row is missing. The table is therefore additive — we only
-- write a row when a store should deviate from the global default.
--
-- Reading: any authenticated user in the store can read flags (they're not
-- secrets; flags that gate UI behavior need to be readable from client
-- components). Writing: service role only, via server actions gated on
-- owner/BevTek-admin role.
--
-- Audit: flag flips are expected to be rare and consequential, so every
-- write through the setFeatureFlag() helper in apps/web/lib/flags.ts drops
-- an `audit_events` row with action="feature_flag.set".

create table if not exists public.feature_flags (
  store_id    uuid not null references public.stores(id) on delete cascade,
  key         text not null,
  value       jsonb not null default 'null'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (store_id, key)
);

create index if not exists feature_flags_key_idx
  on public.feature_flags (key);

-- --------------------------------------------------------------------------
-- Row-level security
-- --------------------------------------------------------------------------
alter table public.feature_flags enable row level security;

-- SELECT: any authenticated member of the store can read their flags.
-- Required so client components inside the (app) group can branch on them
-- without a round-trip through a server action.
drop policy if exists feature_flags_read_own_store on public.feature_flags;
create policy feature_flags_read_own_store
  on public.feature_flags
  for select
  to authenticated
  using (store_id = public.current_store_id());

-- INSERT / UPDATE / DELETE: service role only. `setFeatureFlag()` server
-- action (owner-gated) performs upserts via service-role client.

-- --------------------------------------------------------------------------
-- updated_at trigger (standard BevTek pattern)
-- --------------------------------------------------------------------------
create or replace function public.touch_feature_flags_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists feature_flags_touch_updated_at on public.feature_flags;
create trigger feature_flags_touch_updated_at
  before update on public.feature_flags
  for each row execute function public.touch_feature_flags_updated_at();

comment on table public.feature_flags is
  'Per-store feature flags. Read via apps/web/lib/flags.ts; writes are owner-gated and audited.';
