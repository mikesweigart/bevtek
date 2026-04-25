-- ============================================================================
-- Multi-store foundation
-- ============================================================================
-- Phase 1 of the move from "one user = one store" to "one organization owns
-- N stores, with per-store team members."
--
-- This migration is SAFE to run on production — it is additive-only:
--   * New columns on stores (address, hours, trial_ends_at, sales_tax)
--   * New table organizations (1:1 backfill from existing stores)
--   * New table organization_members (backfill from current users)
--   * New table user_removal_log (audit for offboarding)
--   * New RPC public.remove_team_member(uuid, text)
--
-- It does NOT:
--   * Change users.store_id (stays single-FK for now)
--   * Change current_store_id() (stays reading users.store_id)
--   * Move plan/billing to organizations (stays on stores for now)
--
-- Those flips happen in Phase 2 once the app is reading from the new tables
-- and the UI has a store switcher. Until then, single-store users see zero
-- behavior change — the new tables are populated but nothing queries them.
--
-- APPLY VIA: Supabase Dashboard → SQL Editor → paste → run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend `stores` with fields we should have collected during onboarding
-- ----------------------------------------------------------------------------
-- address_*  — plain columns (not JSONB) so city/region-based reports stay
--              SQL-ergonomic. address_line_2 optional for apartments/suites.
-- hours_json — JSONB because open/close per weekday plus optional holiday
--              overrides fit JSONB's flexibility better than columns.
--              Shape: {"mon":{"open":"09:00","close":"22:00","closed":false}, ...}
-- trial_ends_at — authoritative for "is this store past trial?" checks.
--              Backfill sets it to created_at + 14 days so existing stores
--              without explicit trial timelines don't silently turn into
--              perpetual free-tier accounts. Paid plans ignore it.
-- sales_tax_rate — decimal(5,4). 0.0800 = 8%. Used by the checkout/pickup
--              UI and Gabby's "includes tax" phrasing in the voice script.
alter table public.stores
  add column if not exists address_line_1  text,
  add column if not exists address_line_2  text,
  add column if not exists city            text,
  add column if not exists region          text,
  add column if not exists postal_code     text,
  add column if not exists country_code    text default 'US',
  add column if not exists hours_json      jsonb not null default '{}'::jsonb,
  add column if not exists trial_ends_at   timestamptz,
  add column if not exists sales_tax_rate  numeric(5,4);

-- Backfill trial_ends_at so "is on trial" checks have a real timestamp.
-- Existing trial stores get 14 days from signup (matches lib/stripe/config.ts
-- TRIAL_DAYS = 14). Stores already on a paid plan get no trial expiry.
update public.stores
   set trial_ends_at = created_at + interval '14 days'
 where trial_ends_at is null
   and plan = 'trial';

-- ----------------------------------------------------------------------------
-- 2. organizations — the billing/identity root for multi-store operators
-- ----------------------------------------------------------------------------
-- One row per customer account. A single-store operator has exactly one org
-- with one store. A three-location operator has one org with three stores
-- and shared billing/team.
--
-- plan/stripe_customer_id live here because billing is org-level going
-- forward (you buy one subscription, it covers all your locations). The
-- existing stores.plan column stays for backward compat until phase 2.
create table if not exists public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  billing_email       text,
  stripe_customer_id  text unique,
  plan                text not null default 'trial',
  trial_ends_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists organizations_stripe_cust_idx
  on public.organizations(stripe_customer_id);

-- Backfill: create one organization per existing store (1:1) so every store
-- has an org_id once we add the column below. Guarded by WHERE NOT EXISTS
-- so re-runs of this migration are idempotent.
insert into public.organizations (id, name, stripe_customer_id, plan, trial_ends_at, created_at)
select
  gen_random_uuid(),
  s.name,
  s.stripe_customer_id,
  s.plan,
  s.trial_ends_at,
  s.created_at
from public.stores s
where not exists (
  select 1 from public.organizations o
  where o.stripe_customer_id is not distinct from s.stripe_customer_id
    and o.name = s.name
);

-- ----------------------------------------------------------------------------
-- 3. stores.organization_id — link every store to its owning org
-- ----------------------------------------------------------------------------
-- Nullable for now so the column add doesn't fail on an empty org table
-- edge case in a just-migrated environment. We backfill immediately below
-- and can SET NOT NULL in phase 2 once the app reliably writes it.
alter table public.stores
  add column if not exists organization_id uuid
    references public.organizations(id) on delete cascade;

create index if not exists stores_org_idx on public.stores(organization_id);

-- Backfill stores.organization_id from the name+stripe_customer_id match we
-- used above. Handles the 1:1 case; multi-store customers will get proper
-- org consolidation through the onboarding v2 UX.
update public.stores s
   set organization_id = o.id
  from public.organizations o
 where s.organization_id is null
   and o.name = s.name
   and o.stripe_customer_id is not distinct from s.stripe_customer_id;

-- ----------------------------------------------------------------------------
-- 4. organization_members — user ↔ org with role + default store
-- ----------------------------------------------------------------------------
-- Replaces the single users.store_id for multi-store operators. In phase 2
-- we'll migrate current_store_id() to read from this table (via a session
-- cookie carrying the "current store") and drop the not-null on
-- users.store_id.
--
-- role expands from {owner, manager, staff} to {owner, admin, manager,
-- staff}. "admin" = organization-level manager who can manage billing and
-- add/remove stores. "owner" = the seat that owns the Stripe subscription.
-- "manager" = store-level manager (hires staff). "staff" = employee.
--
-- default_store_id is the store the member lands on when they sign in; they
-- can switch to any other store where they have access via the store
-- switcher (phase 2 UI).
create table if not exists public.organization_members (
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  role              text not null default 'staff'
    check (role in ('owner','admin','manager','staff')),
  default_store_id  uuid references public.stores(id) on delete set null,
  created_at        timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists org_members_user_idx on public.organization_members(user_id);

-- Backfill from existing users → organization_members so every current
-- user has a membership row. Idempotent via ON CONFLICT.
insert into public.organization_members (organization_id, user_id, role, default_store_id, created_at)
select
  s.organization_id,
  u.id,
  u.role,
  u.store_id,
  u.created_at
from public.users u
join public.stores s on s.id = u.store_id
where s.organization_id is not null
on conflict (organization_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. user_removal_log — audit trail for offboarding
-- ----------------------------------------------------------------------------
-- When a manager removes a team member, we log who/when/why here for
-- compliance + debugging ("why can Jane no longer log in?"). Not FK'd to
-- users on removed_user_id because the row survives the user's deletion.
create table if not exists public.user_removal_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete set null,
  store_id         uuid references public.stores(id) on delete set null,
  removed_user_id  uuid,
  removed_email    text,
  removed_role     text,
  removed_by       uuid references public.users(id) on delete set null,
  reason           text,
  created_at       timestamptz not null default now()
);

create index if not exists user_removal_log_org_idx
  on public.user_removal_log(organization_id);
create index if not exists user_removal_log_store_idx
  on public.user_removal_log(store_id);

-- ----------------------------------------------------------------------------
-- 6. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.organizations       enable row level security;
alter table public.organization_members enable row level security;
alter table public.user_removal_log    enable row level security;

-- organizations: visible to any member; editable by owner/admin.
drop policy if exists organizations_select_members on public.organizations;
create policy organizations_select_members
  on public.organizations for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
    )
  );

drop policy if exists organizations_update_admins on public.organizations;
create policy organizations_update_admins
  on public.organizations for update
  to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- organization_members: you can see your own memberships AND all memberships
-- in orgs you belong to (so the Team page renders the full roster).
-- Management (insert/update/delete) is restricted to owner/admin via a
-- single "for all" policy.
drop policy if exists org_members_select_own_orgs on public.organization_members;
create policy org_members_select_own_orgs
  on public.organization_members for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members
       where user_id = auth.uid()
    )
  );

drop policy if exists org_members_manage_by_admin on public.organization_members;
create policy org_members_manage_by_admin
  on public.organization_members for all
  to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- user_removal_log: read-only for org-level managers; writes only via
-- the security-definer RPC below.
drop policy if exists user_removal_log_read_admins on public.user_removal_log;
create policy user_removal_log_read_admins
  on public.user_removal_log for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = user_removal_log.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin','manager')
    )
  );

-- ----------------------------------------------------------------------------
-- 7. RPC: remove_team_member — safe offboarding with audit
-- ----------------------------------------------------------------------------
-- Deletes public.users row for the target, logs the action, and leaves the
-- auth.users row in place (Supabase admin API handles the full auth purge
-- if we ever need it — but for now, removing the public.users row is
-- sufficient: RLS denies everything without a users row, so the session
-- effectively stops working on next request).
--
-- Guards:
--   * actor must be authenticated
--   * actor cannot remove themselves
--   * actor must be owner or manager of the target's store
--   * cannot remove the last owner of a store (would lock the store out)
create or replace function public.remove_team_member(
  p_target_user_id uuid,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   uuid := auth.uid();
  v_actor_role text;
  v_target     public.users%rowtype;
  v_org_id     uuid;
begin
  if v_actor_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_actor_id = p_target_user_id then
    raise exception 'cannot remove yourself' using errcode = '42501';
  end if;

  select * into v_target from public.users where id = p_target_user_id;
  if not found then
    raise exception 'user not found' using errcode = '42704';
  end if;

  select role into v_actor_role
    from public.users
   where id = v_actor_id and store_id = v_target.store_id;
  if v_actor_role is null or v_actor_role not in ('owner','manager') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_target.role = 'owner' and (
    select count(*) from public.users
     where store_id = v_target.store_id and role = 'owner'
  ) <= 1 then
    raise exception 'cannot remove the last owner' using errcode = '42501';
  end if;

  select organization_id into v_org_id from public.stores where id = v_target.store_id;

  insert into public.user_removal_log (
    organization_id, store_id, removed_user_id,
    removed_email, removed_role, removed_by, reason
  ) values (
    v_org_id, v_target.store_id, p_target_user_id,
    v_target.email, v_target.role, v_actor_id, p_reason
  );

  delete from public.organization_members where user_id = p_target_user_id;
  delete from public.users where id = p_target_user_id;
end;
$$;
revoke all on function public.remove_team_member(uuid, text) from public;
grant execute on function public.remove_team_member(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPC: add_store_to_org — multi-store operators add additional locations
-- ----------------------------------------------------------------------------
-- Creates a new store attached to an existing organization. Actor must be
-- owner/admin of the org. Returns the new store.id.
create or replace function public.add_store_to_org(
  p_organization_id uuid,
  p_store_name      text,
  p_phone           text default null,
  p_timezone        text default 'America/New_York',
  p_address_line_1  text default null,
  p_city            text default null,
  p_region          text default null,
  p_postal_code     text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_store_id uuid;
begin
  if v_actor_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_members
     where organization_id = p_organization_id
       and user_id = v_actor_id
       and role in ('owner','admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_store_name is null or length(trim(p_store_name)) = 0 then
    raise exception 'store name is required' using errcode = '22023';
  end if;

  insert into public.stores (
    organization_id, name, phone, timezone,
    address_line_1, city, region, postal_code
  ) values (
    p_organization_id, trim(p_store_name), nullif(trim(p_phone), ''),
    coalesce(p_timezone, 'America/New_York'),
    nullif(trim(p_address_line_1), ''), nullif(trim(p_city), ''),
    nullif(trim(p_region), ''), nullif(trim(p_postal_code), '')
  )
  returning id into v_store_id;

  return v_store_id;
end;
$$;
revoke all on function public.add_store_to_org(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.add_store_to_org(uuid, text, text, text, text, text, text, text) to authenticated;

-- ============================================================================
-- Done. Verification queries (run manually to confirm):
--   select count(*) from public.organizations;
--     -- should equal count of pre-migration stores
--   select count(*) from public.organization_members;
--     -- should equal count of pre-migration public.users rows
--   select count(*) from public.stores where organization_id is null;
--     -- should be 0
-- ============================================================================
