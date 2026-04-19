-- Audit log for privileged staff/admin actions.
--
-- Every write that a human-with-a-login performs against another
-- person's data, or against global/cross-tenant state, drops a row
-- here. Customer-facing self-service mutations (a shopper updating
-- their own cart) are out of scope — this table is specifically for
-- the "who changed what on whose behalf" question that audit teams
-- and incident responders ask.
--
-- Wired call sites (initial cut):
--   - support ticket status transitions
--   - national-promotion create / end  (BevTek admin, service role)
--   - team invite create / revoke
--   - store settings update
--   - store delete
--
-- Keep `metadata` minimal. Never store raw payloads — that's how
-- secrets end up in audit logs. Record the SHAPE of the change
-- (field names + old/new booleans) not the contents.

create table if not exists public.audit_events (
  id               bigserial primary key,
  actor_id         uuid,                    -- auth.users.id, or null for service-role/system
  actor_email      text,                    -- denormalized for quick scans; null-ok
  store_id         uuid,                    -- tenant scope, null for cross-tenant actions
  action           text not null,           -- 'support.ticket.status_update', 'promo.national.create', ...
  target_type      text,                    -- 'ticket' | 'store' | 'invite' | 'promotion' | ...
  target_id        text,                    -- free-form id of the target
  metadata         jsonb not null default '{}'::jsonb,
  ip               inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index if not exists audit_events_store_idx
  on public.audit_events (store_id, created_at desc);
create index if not exists audit_events_actor_idx
  on public.audit_events (actor_id, created_at desc);
create index if not exists audit_events_action_idx
  on public.audit_events (action, created_at desc);

-- Service-role only. Reads go through Supabase SQL editor or a future
-- admin-only viewer. We deliberately do NOT expose this table via RLS
-- policies today — granting even read access to store owners would
-- leak cross-tenant action history once we add a BevTek-admin role.
alter table public.audit_events enable row level security;

comment on table public.audit_events is
  'Privileged-action audit log. Service-role write only. See apps/web/lib/audit/log.ts.';
