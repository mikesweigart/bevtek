-- Invite flow RPCs.
-- create_invite: called by owner/manager to provision a token row.
-- accept_invite: called by a freshly-signed-up auth user to join the store.
-- lookup_invite: called (unauthenticated) by the invite link page to show email/role context.

-- ---------------------------------------------------------------------------
-- create_invite
-- ---------------------------------------------------------------------------

create or replace function public.create_invite(
  p_email text,
  p_role  text default 'staff'
) returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_store_id uuid;
  v_role     text;
  v_token    text;
  v_expires  timestamptz := now() + interval '14 days';
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select store_id, role into v_store_id, v_role
  from public.users where id = v_user_id;

  if v_store_id is null then
    raise exception 'user has no store' using errcode = '42501';
  end if;

  if v_role not in ('owner','manager') then
    raise exception 'only owners or managers can invite' using errcode = '42501';
  end if;

  if p_role not in ('owner','manager','staff') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email is required' using errcode = '22023';
  end if;

  -- Random 32-char URL-safe token.
  v_token := replace(replace(encode(gen_random_bytes(24), 'base64'), '/', '_'), '+', '-');

  return query
  insert into public.invites (store_id, email, role, token, invited_by, expires_at)
  values (v_store_id, lower(trim(p_email)), p_role, v_token, v_user_id, v_expires)
  returning invites.id, invites.token, invites.expires_at;
end;
$$;

revoke all on function public.create_invite(text, text) from public;
grant execute on function public.create_invite(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- lookup_invite
-- Returns the email and role for a valid, unaccepted invite token.
-- Safe to call without auth so the invite page can show context.
-- ---------------------------------------------------------------------------

create or replace function public.lookup_invite(p_token text)
returns table (email text, role text, store_name text, expired boolean, accepted boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select i.email, i.role, s.name, (i.expires_at < now()) as expired, (i.accepted_at is not null) as accepted
  from public.invites i
  join public.stores s on s.id = i.store_id
  where i.token = p_token;
end;
$$;

revoke all on function public.lookup_invite(text) from public;
grant execute on function public.lookup_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_invite
-- Called by an authenticated user (just signed up) to join the store.
-- Verifies the token, checks email match, inserts the public.users row,
-- marks invite accepted.
-- ---------------------------------------------------------------------------

create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_email    text;
  v_invite   record;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'user already belongs to a store' using errcode = '23505';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  select * into v_invite from public.invites where token = p_token;
  if v_invite is null then
    raise exception 'invite not found' using errcode = '22023';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'invite already accepted' using errcode = '22023';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'invite expired' using errcode = '22023';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'invite email does not match your account' using errcode = '22023';
  end if;

  insert into public.users (id, store_id, email, full_name, role)
  values (v_user_id, v_invite.store_id, v_email, null, v_invite.role);

  update public.invites set accepted_at = now() where id = v_invite.id;

  return v_invite.store_id;
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;
