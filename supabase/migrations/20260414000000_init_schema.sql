-- BevTek.ai initial schema
-- Multi-tenant: every business table carries store_id and is gated by RLS
-- Auth model: public.users.id == auth.users.id (one row per signed-in user)

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table public.stores (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique,
  phone           text,
  timezone        text not null default 'America/New_York',
  stripe_customer_id text,
  plan            text not null default 'trial',
  created_at      timestamptz not null default now()
);

create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  store_id    uuid not null references public.stores(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'staff'
    check (role in ('owner','manager','staff')),
  expo_push_token text,
  created_at  timestamptz not null default now()
);
create index users_store_idx on public.users(store_id);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  email       text not null,
  role        text not null default 'staff'
    check (role in ('owner','manager','staff')),
  token       text not null unique,
  invited_by  uuid references public.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);
create index invites_store_idx on public.invites(store_id);
create index invites_email_idx on public.invites(email);

-- ---------------------------------------------------------------------------
-- Megan Trainer
-- ---------------------------------------------------------------------------

create table public.modules (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  title        text not null,
  description  text,
  content      jsonb not null default '{}'::jsonb,
  category     text,
  duration_minutes int,
  is_published boolean not null default false,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index modules_store_idx on public.modules(store_id);

create table public.progress (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  module_id     uuid not null references public.modules(id) on delete cascade,
  status        text not null default 'not_started'
    check (status in ('not_started','in_progress','completed')),
  score         numeric,
  started_at    timestamptz,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (user_id, module_id)
);
create index progress_store_idx on public.progress(store_id);
create index progress_user_idx on public.progress(user_id);

-- ---------------------------------------------------------------------------
-- Inventory (shared by Assistant, Shopper, Receptionist)
-- ---------------------------------------------------------------------------

create table public.inventory (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  sku          text,
  name         text not null,
  brand        text,
  category     text,
  subcategory  text,
  size_ml      int,
  abv          numeric,
  price        numeric(10,2),
  cost         numeric(10,2),
  stock_qty    int not null default 0,
  description  text,
  tasting_notes text,
  metadata     jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (store_id, sku)
);
create index inventory_store_idx on public.inventory(store_id);
create index inventory_name_idx on public.inventory(store_id, name);
create index inventory_category_idx on public.inventory(store_id, category);

-- ---------------------------------------------------------------------------
-- Megan Assistant (floor AI)
-- ---------------------------------------------------------------------------

create table public.floor_queries (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  query_text   text not null,
  response     text,
  item_ids     uuid[],
  language     text default 'en',
  context      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index floor_queries_store_idx on public.floor_queries(store_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Megan Receptionist (Retell AI)
-- ---------------------------------------------------------------------------

create table public.call_logs (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  retell_call_id  text unique,
  from_number     text,
  to_number       text,
  direction       text default 'inbound'
    check (direction in ('inbound','outbound')),
  status          text,
  duration_sec    int,
  transcript      text,
  summary         text,
  recording_url   text,
  metadata        jsonb not null default '{}'::jsonb,
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);
create index call_logs_store_idx on public.call_logs(store_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Megan Texting (Sendblue iMessage) — consent tracking
-- ---------------------------------------------------------------------------

create table public.sms_consent (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  phone_number  text not null,
  consented     boolean not null default true,
  source        text,
  consented_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  unique (store_id, phone_number)
);
create index sms_consent_store_idx on public.sms_consent(store_id);

-- ---------------------------------------------------------------------------
-- Helper: current user's store_id (SECURITY DEFINER avoids RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from public.users where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.stores         enable row level security;
alter table public.users          enable row level security;
alter table public.invites        enable row level security;
alter table public.modules        enable row level security;
alter table public.progress       enable row level security;
alter table public.inventory      enable row level security;
alter table public.floor_queries  enable row level security;
alter table public.call_logs      enable row level security;
alter table public.sms_consent    enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- Pattern: any authenticated user can see rows where store_id = their store.
-- Writes to sensitive tables (modules, invites, inventory, stores) require
-- manager or owner role. User can always read/update their own users row.
-- ---------------------------------------------------------------------------

-- stores: members can read their store; owners can update
create policy stores_select on public.stores
  for select to authenticated
  using (id = public.current_store_id());

create policy stores_update on public.stores
  for update to authenticated
  using (id = public.current_store_id() and public.current_user_role() = 'owner')
  with check (id = public.current_store_id());

-- users: read rows in same store; update your own row
create policy users_select on public.users
  for select to authenticated
  using (store_id = public.current_store_id());

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and store_id = public.current_store_id());

create policy users_manage on public.users
  for all to authenticated
  using (store_id = public.current_store_id()
         and public.current_user_role() in ('owner','manager'))
  with check (store_id = public.current_store_id());

-- invites: managers/owners manage
create policy invites_all on public.invites
  for all to authenticated
  using (store_id = public.current_store_id()
         and public.current_user_role() in ('owner','manager'))
  with check (store_id = public.current_store_id());

-- modules: everyone in store reads; managers/owners write
create policy modules_select on public.modules
  for select to authenticated
  using (store_id = public.current_store_id());

create policy modules_write on public.modules
  for all to authenticated
  using (store_id = public.current_store_id()
         and public.current_user_role() in ('owner','manager'))
  with check (store_id = public.current_store_id());

-- progress: user reads/writes own rows; managers see all in store
create policy progress_self on public.progress
  for all to authenticated
  using (store_id = public.current_store_id() and user_id = auth.uid())
  with check (store_id = public.current_store_id() and user_id = auth.uid());

create policy progress_manager_read on public.progress
  for select to authenticated
  using (store_id = public.current_store_id()
         and public.current_user_role() in ('owner','manager'));

-- inventory: everyone in store reads; managers/owners write
create policy inventory_select on public.inventory
  for select to authenticated
  using (store_id = public.current_store_id());

create policy inventory_write on public.inventory
  for all to authenticated
  using (store_id = public.current_store_id()
         and public.current_user_role() in ('owner','manager'))
  with check (store_id = public.current_store_id());

-- floor_queries: anyone in store can read & insert; delete restricted
create policy floor_queries_select on public.floor_queries
  for select to authenticated
  using (store_id = public.current_store_id());

create policy floor_queries_insert on public.floor_queries
  for insert to authenticated
  with check (store_id = public.current_store_id());

create policy floor_queries_manage on public.floor_queries
  for delete to authenticated
  using (store_id = public.current_store_id()
         and public.current_user_role() in ('owner','manager'));

-- call_logs: read by store members; writes via service role (Retell webhook)
create policy call_logs_select on public.call_logs
  for select to authenticated
  using (store_id = public.current_store_id());

-- sms_consent: read by store members; writes via service role (Sendblue webhook)
create policy sms_consent_select on public.sms_consent
  for select to authenticated
  using (store_id = public.current_store_id());

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger modules_updated_at   before update on public.modules
  for each row execute function public.set_updated_at();
create trigger progress_updated_at  before update on public.progress
  for each row execute function public.set_updated_at();
create trigger inventory_updated_at before update on public.inventory
  for each row execute function public.set_updated_at();
