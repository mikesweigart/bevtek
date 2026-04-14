-- Bootstrap RPC: lets a newly-signed-up auth user create their store
-- and their corresponding public.users row atomically.
-- Runs as SECURITY DEFINER so it bypasses RLS (which otherwise blocks
-- a user with no public.users row from inserting anywhere).

create or replace function public.create_store_for_current_user(
  p_store_name text,
  p_full_name  text default null,
  p_phone      text default null,
  p_timezone   text default 'America/New_York'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_email    text;
  v_store_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- One store per owner at signup time. Additional owners join via invites.
  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'user already belongs to a store' using errcode = '23505';
  end if;

  if p_store_name is null or length(trim(p_store_name)) = 0 then
    raise exception 'store name is required' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  insert into public.stores (name, phone, timezone)
  values (trim(p_store_name), nullif(trim(p_phone), ''), coalesce(p_timezone, 'America/New_York'))
  returning id into v_store_id;

  insert into public.users (id, store_id, email, full_name, role)
  values (v_user_id, v_store_id, v_email, nullif(trim(p_full_name), ''), 'owner');

  return v_store_id;
end;
$$;

revoke all on function public.create_store_for_current_user(text, text, text, text) from public;
grant execute on function public.create_store_for_current_user(text, text, text, text) to authenticated;
