-- Store switcher support.
--
-- In Phase 1 "which store am I looking at" is encoded in users.store_id,
-- and current_store_id() reads that column. The users_update_self RLS
-- policy blocks a user from changing their own store_id directly (the
-- WITH CHECK clause requires the new value to equal current_store_id(),
-- which in MVCC returns the OLD value — a catch-22).
--
-- switch_current_store() is a SECURITY DEFINER escape hatch. It:
--   1. Verifies the caller belongs to the target store's organization via
--      organization_members (not via the legacy users.store_id — that
--      would be circular).
--   2. Maps the org-level role down to the users.role enum
--      (owner/manager/staff), collapsing 'admin' → 'manager' since the
--      users table doesn't have an admin tier yet.
--   3. Updates users.store_id AND users.role in one shot so all RLS on
--      every other table flips atomically with the switch.
--
-- When Phase 2 moves "current store" to a cookie, this RPC gets replaced
-- by a cookie setter and the users.store_id column loses its special
-- role. Until then this is how the switcher works.

create or replace function public.switch_current_store(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id  uuid;
  v_role    text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select organization_id into v_org_id
    from public.stores
   where id = p_store_id;

  if v_org_id is null then
    raise exception 'store not found' using errcode = 'P0002';
  end if;

  select role into v_role
    from public.organization_members
   where organization_id = v_org_id
     and user_id = v_user_id;

  if v_role is null then
    raise exception 'you do not have access to that store'
      using errcode = '42501';
  end if;

  -- Collapse org-level roles to the 3-tier users.role enum.
  if v_role = 'admin' then v_role := 'manager'; end if;
  if v_role not in ('owner', 'manager', 'staff') then v_role := 'staff'; end if;

  update public.users
     set store_id = p_store_id,
         role     = v_role
   where id = v_user_id;
end;
$$;

revoke all on function public.switch_current_store(uuid) from public;
grant execute on function public.switch_current_store(uuid) to authenticated;
