-- Brand advertising / promotional products platform.
-- Brands (Maker's Mark, Hennessy, etc.) pay BevTek to promote across stores.
-- Higher-tier stores can go ad-free.

-- Promotions managed at the BevTek corporate level
create table if not exists public.promotions (
  id              uuid primary key default gen_random_uuid(),
  brand_name      text not null,
  brand_logo_url  text,
  title           text not null,
  description     text,
  image_url       text,
  link_url        text,
  -- Where this promo appears
  placement       text not null default 'trainer_featured'
    check (placement in (
      'trainer_featured',     -- featured module card on Trainer home
      'trainer_explore',      -- sponsored module at top of Explore
      'shopper_banner',       -- banner on customer storefront
      'assistant_promoted',   -- promoted product in Assistant results
      'module_sponsored'      -- sponsored tip within a specific module
    )),
  -- Targeting
  target_regions  text[],     -- e.g. {'southeast', 'northeast'} or null for nationwide
  target_plan_min text,       -- minimum store plan to show (null = all plans)
  -- Scheduling
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  is_active       boolean not null default true,
  -- Budget / tracking
  budget_cents    int,        -- total budget in cents (null = unlimited)
  spent_cents     int not null default 0,
  impressions     int not null default 0,
  clicks          int not null default 0,
  -- Admin
  created_by      text,       -- BevTek admin who created it
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index promotions_active_idx
  on public.promotions (placement, is_active, starts_at)
  where is_active = true;

-- Track impressions and clicks per store
create table if not exists public.promotion_events (
  id            uuid primary key default gen_random_uuid(),
  promotion_id  uuid not null references public.promotions(id) on delete cascade,
  store_id      uuid references public.stores(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  event_type    text not null check (event_type in ('impression', 'click', 'dismiss')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index promotion_events_promo_idx
  on public.promotion_events (promotion_id, created_at desc);

-- RLS: promotions are readable by all authenticated users (they see ads).
-- Only BevTek admins write promotions (via direct DB access or admin portal).
alter table public.promotions enable row level security;
alter table public.promotion_events enable row level security;

create policy promotions_read on public.promotions
  for select to authenticated
  using (is_active = true and starts_at <= now() and (ends_at is null or ends_at > now()));

-- Events: authenticated users can insert (logging impressions/clicks)
create policy promotion_events_insert on public.promotion_events
  for insert to authenticated
  with check (true);

-- Store ad-free flag
alter table public.stores
  add column if not exists ad_free boolean not null default false;

-- Function to fetch active promotions for a placement
create or replace function public.get_active_promotions(
  p_placement text,
  p_limit int default 3
) returns setof public.promotions
language sql
stable
security invoker
as $$
  select *
  from public.promotions
  where is_active = true
    and placement = p_placement
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (budget_cents is null or spent_cents < budget_cents)
  order by random()  -- rotate ads
  limit p_limit;
$$;

grant execute on function public.get_active_promotions(text, int) to authenticated;

comment on table public.promotions is
  'Brand advertising managed by BevTek corporate. Brands pay to promote across all stores. Higher-tier stores can set ad_free=true to hide promotions.';
