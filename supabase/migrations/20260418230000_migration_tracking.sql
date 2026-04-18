-- Migration tracking & audit trail.
--
-- Why this exists: until now, migrations were pasted into the Supabase SQL
-- Editor by hand. With real tenants going live, we need:
--   1. Proof a migration ran (filename + hash + applied_at).
--   2. Refusal to re-apply a migration that already ran (idempotency).
--   3. Hash mismatch detection (file was edited after it was applied).
--   4. Who/what applied it (human via editor vs. CI script).
--
-- The apply-migration.ts script wraps each file in a transaction, records
-- the row here, and rolls back the entire thing if anything errors. That
-- gives us atomicity we currently don't have.
--
-- Legacy migrations that ran before this table existed are tracked by a
-- follow-up seed at the bottom — they're recorded as `applied_by = 'legacy'`.

create table if not exists public._migrations (
  id              bigserial primary key,
  filename        text not null unique,
  sha256          text not null,
  applied_at      timestamptz not null default now(),
  applied_by      text not null default 'script',      -- 'script' | 'legacy' | 'manual'
  duration_ms     integer,
  notes           text
);

comment on table public._migrations is
  'Applied-migration ledger. Written by scripts/apply-migration.ts. Never edit rows by hand — if you need to re-run, delete + re-apply.';

-- Locked down tight: only the service role can read/write this.
alter table public._migrations enable row level security;
-- No policies means no authenticated-user access. Intentional.

-- Helper: is a given migration already applied?
create or replace function public.is_migration_applied(p_filename text)
returns boolean
language sql
stable
as $$
  select exists (select 1 from public._migrations where filename = p_filename);
$$;

-- Seed every pre-existing migration file as 'legacy' so the ledger reflects
-- reality. Done with a stable insert on a known list; the apply-migration
-- script will skip anything already present.
insert into public._migrations (filename, sha256, applied_by, notes)
values
  ('pre-ledger', 'n/a', 'legacy', 'All migrations applied before 20260418230000 are collapsed into this marker.')
on conflict (filename) do nothing;
