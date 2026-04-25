-- Voice receptionist infrastructure.
-- ============================================================
-- Adds per-store configuration + phone number for the Retell
-- voice agent, and a `call_holds` table for items Gabby reserves
-- at the store mid-call.
--
-- WHY THIS MIGRATION:
--   The webhook ingest (20260414080000_webhook_rpc) already
--   writes inbound call_logs, but:
--     (a) the Retell phone number assigned to each store wasn't
--         persisted, so /api/retell/llm can't map
--         to_number → store_id, and
--     (b) per-store voice config (hours, FAQ, escalation, notify
--         prefs, age-gate) had no home.
--   Both fixed here. call_holds is new — it tracks items Gabby
--   sets aside for callers, notifies staff, and shows up on a
--   /holds staff UI.
--
-- SAFETY:
--   All ALTER TABLE calls are `add column if not exists`, so the
--   migration is idempotent. The new table uses `create table if
--   not exists`. RLS is locked to store members.

-- ------------------------------------------------------------
-- 1. stores.retell_phone_number
-- ------------------------------------------------------------
-- The Retell-assigned number that callers dial (or that the
-- store's existing number forwards into). This is our sole
-- routing key at call time — /api/retell/llm looks up the store
-- by matching payload.call.to_number against this column. One
-- number per store; stored as E.164 text (e.g. +15025550143).
alter table public.stores
  add column if not exists retell_phone_number text;

-- Unique: the same Retell number can't be assigned to two stores
-- (would cause routing ambiguity). Partial index so stores
-- without the receptionist add-on can still have NULL here.
create unique index if not exists stores_retell_phone_number_unique
  on public.stores (retell_phone_number)
  where retell_phone_number is not null;

-- ------------------------------------------------------------
-- 2. stores.receptionist_config
-- ------------------------------------------------------------
-- Per-store voice config. JSONB so we can evolve the shape
-- without schema churn. Schema documented below; enforced in
-- application code (lib/ai/claude.ts is the single reader).
alter table public.stores
  add column if not exists receptionist_config jsonb not null default '{}'::jsonb;

comment on column public.stores.receptionist_config is
$$Per-store voice receptionist config. Schema:
{
  greeting_override: text|null,
  hours: { mon: "9-21", tue: "9-21", ..., sun: "closed" },
  timezone: "America/Kentucky/Louisville",
  voicemail_after_hours: bool,
  escalation_phone: text|null,
  escalation_triggers: text[],
  faq: [{q: text, a: text}],
  service_mentions: text[],
  expertise_bias: "casual"|"expert"|"concierge",
  notify_on_hold: {
    email_to: text[]|null,
    sms_to: text[]|null,
    inapp_store_id: bool
  },
  age_gate: { enabled: bool, confirm_phrase: text|null }
}
Defaults to {} for stores without the receptionist add-on — the
prompt builder treats missing fields as reasonable defaults
(age_gate.enabled defaults to true, expertise_bias to "casual").$$;

-- ------------------------------------------------------------
-- 3. call_holds — items Gabby reserves mid-call
-- ------------------------------------------------------------
-- Separate from inventory.stock_qty (that's POS-authoritative;
-- holds are a soft staff-facing reminder). The /holds page lets
-- staff mark ready/picked-up. Expires automatically after 48h so
-- the list doesn't accumulate abandoned requests forever.
create table if not exists public.call_holds (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  -- Links back to call_logs.retell_call_id for provenance. NOT a
  -- FK because webhook ordering means the hold row may land
  -- before the call_ended webhook fires; we don't want to block.
  retell_call_id  text,
  caller_name     text not null,
  caller_phone    text not null,
  -- [{sku?, name, qty, price?}] — name+qty required, sku/price
  -- best-effort (Gabby may not always know sku).
  items           jsonb not null,
  status          text not null default 'pending'
                  check (status in ('pending','ready','picked_up','expired','cancelled')),
  notes           text,
  expires_at      timestamptz not null default (now() + interval '48 hours'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Staff UI reads pending holds for their store, newest first.
create index if not exists call_holds_store_status_idx
  on public.call_holds (store_id, status, created_at desc);

-- Provenance lookup when replaying a specific call.
create index if not exists call_holds_retell_call_idx
  on public.call_holds (retell_call_id)
  where retell_call_id is not null;

-- updated_at auto-refresh
drop trigger if exists call_holds_touch on public.call_holds;
create trigger call_holds_touch
  before update on public.call_holds
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. Row-level security for call_holds
-- ------------------------------------------------------------
-- Members of the store can read + update their own holds.
-- INSERT from Gabby's tool handler uses the service-role key,
-- which bypasses RLS — no insert policy needed for the agent
-- path. Web UI inserts (manual staff adds) go through the
-- insert_own_store policy below.
alter table public.call_holds enable row level security;

drop policy if exists call_holds_read_own_store on public.call_holds;
create policy call_holds_read_own_store on public.call_holds
  for select using (store_id = public.current_store_id());

drop policy if exists call_holds_insert_own_store on public.call_holds;
create policy call_holds_insert_own_store on public.call_holds
  for insert with check (store_id = public.current_store_id());

drop policy if exists call_holds_update_own_store on public.call_holds;
create policy call_holds_update_own_store on public.call_holds
  for update using (store_id = public.current_store_id())
                with check (store_id = public.current_store_id());

-- Deletes are intentionally NOT allowed via policy. Staff "delete"
-- a hold by marking status='cancelled' — preserves audit trail.
