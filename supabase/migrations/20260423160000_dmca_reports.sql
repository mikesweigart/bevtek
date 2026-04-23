-- =============================================================================
-- dmca_reports — DMCA takedown notices submitted via the public form
-- =============================================================================
-- Legal prerequisite for App Store review and for Section 512(c) safe harbor:
-- we need a public, advertised process for rights-holders to report
-- infringing content hosted on BevTek (primarily staff-submitted product
-- photos that might duplicate a photographer's work or a distributor's
-- label without license).
--
-- Flow:
--   1. Claimant fills /dmca form → POST /api/legal/dmca
--   2. Row lands here with `status='submitted'`
--   3. BevTek staff triages in /admin/dmca (future page; for now reviewed
--      directly via Supabase SQL editor + an email to the DMCA alias).
--   4. Staff updates status; if `content_removed`, the referenced submission
--      (catalog_image_submissions.id via `infringing_submission_id`) gets
--      soft-rejected through the existing moderation UI.
--
-- CSAM reports are a separate legal path (NCMEC CyberTipline) and are NOT
-- stored here — the /dmca page links out to NCMEC for that case so we never
-- hold CSAM content, even in a takedown queue.
--
-- Service-role write only; the /api/legal/dmca route uses the service
-- client. The table is RLS-on-no-policies so nothing can read it directly
-- from the client.

create table if not exists public.dmca_reports (
  id                            bigserial primary key,

  -- Claimant identification — required per 17 USC 512(c)(3)(A)
  claimant_name                 text not null,
  claimant_email                text not null,
  claimant_phone                text,
  claimant_address              text,
  claimant_authorized_to_act    boolean not null default false,    -- "I am the owner or authorized to act on behalf of the owner"

  -- Work + location
  copyrighted_work_description  text not null,
  infringing_url                text not null,
  infringing_submission_id      uuid,                              -- catalog_image_submissions.id when applicable

  -- Sworn statements (must both be true to submit; we enforce in the API
  -- route too, but keeping CHECKs here as a belt-and-suspenders so a
  -- bypassed API never writes a legally-defective row).
  good_faith_statement          boolean not null default false check (good_faith_statement = true),
  accuracy_statement            boolean not null default false check (accuracy_statement = true),

  -- Digital signature (typed full legal name)
  signature                     text not null,

  -- Triage
  status                        text not null default 'submitted'
    check (status in ('submitted','under_review','content_removed','counter_notice','dismissed','invalid')),
  reviewed_at                   timestamptz,
  reviewed_by                   uuid references public.users(id) on delete set null,
  internal_notes                text,

  -- Provenance
  ip                            inet,
  user_agent                    text,
  created_at                    timestamptz not null default now()
);

create index if not exists dmca_reports_status_idx
  on public.dmca_reports (status, created_at desc);

create index if not exists dmca_reports_submission_idx
  on public.dmca_reports (infringing_submission_id)
  where infringing_submission_id is not null;

-- --------------------------------------------------------------------------
-- Row-level security
-- --------------------------------------------------------------------------
alter table public.dmca_reports enable row level security;

-- No policies — service role only. Public form writes go through
-- /api/legal/dmca (service-role client); admin reads will go through a
-- future BevTek-admin-gated page.

comment on table public.dmca_reports is
  'DMCA 17 USC 512 takedown notices. Service-role only. Submitted via /dmca public form.';
