-- Webhook idempotency ledger.
--
-- Every inbound webhook (Stripe, Retell, Sendblue, future integrations)
-- drops a row here keyed by (provider, event_id). If the row already
-- exists, the handler short-circuits — the event has already been
-- processed. This matters because:
--   1. All three providers retry on 5xx or on receiver timeout. Without
--      idempotency we double-apply side effects (double-charge a store,
--      send a duplicate SMS, replay a call transcript).
--   2. Stripe explicitly documents "deliver at least once, sometimes
--      more than once" — they expect us to dedupe.
--   3. Vercel cold starts occasionally blow past Stripe's 20s timeout,
--      triggering a retry even when we processed the first delivery.
--
-- Row layout intentionally small: provider, event_id, received_at,
-- event_type, handled boolean, handle_error text. No payload — that's
-- already in the provider's own dashboards, and keeping secrets out of
-- our DB is worth more than the convenience of a local copy.

create table if not exists public.webhook_events (
  id               bigserial primary key,
  provider         text not null,           -- 'stripe' | 'retell' | 'sendblue' | ...
  event_id         text not null,           -- provider's own event id
  event_type       text,                    -- 'invoice.payment_succeeded' etc.
  received_at      timestamptz not null default now(),
  handled_at       timestamptz,
  handled          boolean not null default false,
  handle_error     text,
  unique (provider, event_id)
);

create index if not exists webhook_events_received_idx
  on public.webhook_events (received_at desc);

-- Service-role only. Webhook routes run with service role (they have
-- no user context), and we don't want staff browsing the log through
-- RLS without explicit policies. Ops access goes through Supabase's
-- SQL editor for now.
alter table public.webhook_events enable row level security;

comment on table public.webhook_events is
  'Idempotency ledger for inbound webhooks. Keyed on (provider, event_id). See apps/web/lib/webhooks/idempotency.ts.';
