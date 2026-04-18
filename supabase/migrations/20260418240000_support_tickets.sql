-- Support tickets: an in-app "Report a problem" flow that lets staff
-- and shoppers send us context when something breaks, instead of
-- emailing a vague "it's not working" in a week.
--
-- Why a dedicated table vs. an external tool (Linear/Zendesk/etc):
--   1. Launch of 5 stores is imminent — we need SOMETHING, today.
--   2. Store+user+last-action context is already in our DB. Fewer hops.
--   3. We can query ticket volume per prompt version / per store /
--      per surface to triage AI quality regressions fast.
--   4. Can always export to Linear later; hard to do the reverse.

create table if not exists public.support_tickets (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- Who reported it. store_id + user_id are both optional because
  -- an anonymous shopper can also file a ticket from the public
  -- shopper surface.
  store_id          uuid references public.stores(id) on delete set null,
  user_id           uuid references auth.users(id) on delete set null,
  user_role         text,                                    -- 'customer' | 'employee' | 'manager' | 'admin' | null
  reporter_email    text,                                    -- filled for anonymous reporters
  reporter_name     text,

  -- What they told us
  subject           text not null,
  description       text not null,
  severity          text not null default 'normal'
                    check (severity in ('low','normal','high','urgent')),

  -- Where it happened
  surface           text,                                    -- 'mobile' | 'web-portal' | 'shopper-storefront' | 'voice'
  screen            text,                                    -- last screen / route the user was on
  app_version       text,                                    -- mobile bundle version or web build sha

  -- Machine context the client attaches automatically
  last_action       text,                                    -- short human-readable last-thing
  context_json      jsonb,                                   -- free-form: recent messages, prompt_version, etc.
  user_agent        text,

  -- Triage state
  status            text not null default 'open'
                    check (status in ('open','in_progress','resolved','wont_fix','duplicate')),
  assignee_email    text,
  resolved_at       timestamptz,
  resolution_notes  text
);

create index if not exists support_tickets_store_created_idx
  on public.support_tickets (store_id, created_at desc);
create index if not exists support_tickets_status_severity_idx
  on public.support_tickets (status, severity, created_at desc);

-- RLS: reporters can see their own tickets; managers/admins see their
-- store's tickets; anonymous anonymous-email reporters have no read
-- access (we email them out-of-band). Inserts are always allowed but
-- the service-role writes get the full picture via the API.

alter table public.support_tickets enable row level security;

-- Any authenticated user may file a ticket for themselves.
create policy support_tickets_insert_self
  on public.support_tickets
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Anonymous (public) inserts allowed — shopper storefront / mobile age-gated
-- surface where user isn't signed in. We require reporter_email so we can
-- follow up. The API layer rate-limits this path.
create policy support_tickets_insert_anon
  on public.support_tickets
  for insert
  to anon
  with check (user_id is null and reporter_email is not null);

-- Reporter can read their own tickets.
create policy support_tickets_select_own
  on public.support_tickets
  for select
  to authenticated
  using (user_id = auth.uid());

-- Managers/admins see tickets for their store.
create policy support_tickets_select_store_staff
  on public.support_tickets
  for select
  to authenticated
  using (
    store_id in (
      select u.store_id
        from public.users u
       where u.id = auth.uid()
         and u.role in ('manager','admin')
    )
  );

-- Managers/admins can update tickets in their store (to mark resolved, etc.)
create policy support_tickets_update_store_staff
  on public.support_tickets
  for update
  to authenticated
  using (
    store_id in (
      select u.store_id
        from public.users u
       where u.id = auth.uid()
         and u.role in ('manager','admin')
    )
  )
  with check (
    store_id in (
      select u.store_id
        from public.users u
       where u.id = auth.uid()
         and u.role in ('manager','admin')
    )
  );

comment on table public.support_tickets is
  'In-app Report-a-Problem tickets. Written by /api/support/ticket. See apps/mobile/components/ReportProblemModal.tsx and apps/web/app/(app)/admin/support/page.tsx for the reporter + triage surfaces.';
