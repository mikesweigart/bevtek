-- Webhook plumbing for Megan Receptionist (Retell AI) and Megan Texting (Sendblue).
-- Both external services will POST events to our Next.js API route, which
-- forwards them to these SECURITY DEFINER functions. Each function:
--   1. Validates a per-store webhook secret (rotatable, no service_role key needed).
--   2. Inserts/upserts the event row under the right store_id.
--
-- Store owners set their secret via /settings (column added here) and paste it
-- into the Retell / Sendblue dashboard webhook config.

alter table public.stores
  add column if not exists retell_webhook_secret text,
  add column if not exists sendblue_webhook_secret text,
  add column if not exists retell_agent_id text,
  add column if not exists sendblue_number text;

-- ---------------------------------------------------------------------------
-- Receptionist: log an inbound call
-- Called by our Next.js /api/retell/webhook route after Retell posts.
-- ---------------------------------------------------------------------------

create or replace function public.webhook_log_call(
  p_secret       text,
  p_retell_call_id text,
  p_from_number  text,
  p_to_number    text,
  p_direction    text default 'inbound',
  p_status       text default null,
  p_duration_sec int default null,
  p_transcript   text default null,
  p_summary      text default null,
  p_recording_url text default null,
  p_metadata     jsonb default '{}'::jsonb,
  p_started_at   timestamptz default null,
  p_ended_at     timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_store_id uuid;
  v_id       uuid;
begin
  if p_secret is null or length(p_secret) < 16 then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  select id into v_store_id
  from public.stores
  where retell_webhook_secret = p_secret;

  if v_store_id is null then
    raise exception 'secret does not match any store' using errcode = '42501';
  end if;

  insert into public.call_logs (
    store_id, retell_call_id, from_number, to_number, direction,
    status, duration_sec, transcript, summary, recording_url, metadata,
    started_at, ended_at
  ) values (
    v_store_id, p_retell_call_id, p_from_number, p_to_number, coalesce(p_direction, 'inbound'),
    p_status, p_duration_sec, p_transcript, p_summary, p_recording_url, coalesce(p_metadata, '{}'::jsonb),
    p_started_at, p_ended_at
  )
  on conflict (retell_call_id) do update set
    status = excluded.status,
    duration_sec = excluded.duration_sec,
    transcript = excluded.transcript,
    summary = excluded.summary,
    recording_url = excluded.recording_url,
    metadata = public.call_logs.metadata || excluded.metadata,
    ended_at = coalesce(excluded.ended_at, public.call_logs.ended_at)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.webhook_log_call(text, text, text, text, text, text, int, text, text, text, jsonb, timestamptz, timestamptz) from public;
grant execute on function public.webhook_log_call(text, text, text, text, text, text, int, text, text, text, jsonb, timestamptz, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Texting: log an inbound or outbound iMessage
-- ---------------------------------------------------------------------------

-- Separate sms_messages table is overkill for now; we'll track consent only
-- in sms_consent (already exists). A full messaging UI is coming later.
-- Shipping the plumbing so the webhook can at least record consent events.

create or replace function public.webhook_log_sms(
  p_secret      text,
  p_phone       text,
  p_consented   boolean default null,
  p_source      text default null,
  p_metadata    jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_store_id uuid;
  v_id uuid;
begin
  if p_secret is null or length(p_secret) < 16 then
    raise exception 'invalid secret' using errcode = '42501';
  end if;

  select id into v_store_id
  from public.stores
  where sendblue_webhook_secret = p_secret;

  if v_store_id is null then
    raise exception 'secret does not match any store' using errcode = '42501';
  end if;

  insert into public.sms_consent (store_id, phone_number, consented, source, metadata)
  values (v_store_id, p_phone, coalesce(p_consented, true), p_source, coalesce(p_metadata, '{}'::jsonb))
  on conflict (store_id, phone_number) do update set
    consented = coalesce(excluded.consented, public.sms_consent.consented),
    revoked_at = case when excluded.consented = false then now() else null end,
    metadata = public.sms_consent.metadata || excluded.metadata
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.webhook_log_sms(text, text, boolean, text, jsonb) from public;
grant execute on function public.webhook_log_sms(text, text, boolean, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC for owner to rotate their webhook secrets (and set phone line / agent).
-- ---------------------------------------------------------------------------

create or replace function public.rotate_receptionist_secret()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_role text;
  v_secret text;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  select store_id, role into v_store_id, v_role from public.users where id = v_user_id;
  if v_role <> 'owner' then raise exception 'only owner'; end if;
  v_secret := replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-');
  update public.stores set retell_webhook_secret = v_secret where id = v_store_id;
  return v_secret;
end;
$$;
grant execute on function public.rotate_receptionist_secret() to authenticated;

create or replace function public.rotate_texting_secret()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_role text;
  v_secret text;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  select store_id, role into v_store_id, v_role from public.users where id = v_user_id;
  if v_role <> 'owner' then raise exception 'only owner'; end if;
  v_secret := replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-');
  update public.stores set sendblue_webhook_secret = v_secret where id = v_store_id;
  return v_secret;
end;
$$;
grant execute on function public.rotate_texting_secret() to authenticated;
