-- Promotions: unified table for both store-featured items and paid national
-- campaigns. One table keeps the display layer simple — the shop page just
-- queries "active promos for this store" and renders them identically.
--
-- Two flavors, distinguished by `kind`:
--   - 'store':    a store owner featured one of their own products. No rate,
--                 no targeting, scoped to that one store_id.
--   - 'national': BevTek's national sales team placed a campaign across many
--                 stores. Targeting via target_states / target_categories /
--                 target_store_ids. Auto-shown unless the store opts out.
--
-- Both surface in the same "Featured" row on /shop/[slug] so customers see
-- one consistent experience.

create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('store','national')),

  -- store-kind: the store that's running it. national-kind: null.
  store_id uuid references stores(id) on delete cascade,
  created_by uuid references users(id) on delete set null,

  -- Display content
  title text not null,
  tagline text,
  image_url text,
  cta_label text default 'See it',
  cta_url text,

  -- Link to a real inventory row at display time. For national promos we
  -- match against inventory by brand/upc/category at query time (a national
  -- Tito's promo only shows in stores that actually carry Tito's).
  inventory_id uuid references inventory(id) on delete set null,  -- store-kind direct link
  brand text,                                                      -- national-kind fuzzy match
  upc text,
  category text,

  -- Placement + schedule
  placements text[] not null default array['home_banner','featured_shelf','gabby_boost']::text[],
  priority integer not null default 0,  -- higher = shown first within its tier
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,

  -- National targeting (ignored for store-kind)
  target_states text[],         -- null or empty = all states
  target_categories text[],     -- null or empty = all categories
  target_store_ids uuid[],      -- specific stores opted in; null = all eligible

  -- Billing (national only — store-kind leaves these null)
  rate_model text check (rate_model in ('flat','cpm','cpc')),
  rate_cents integer,
  budget_cents integer,
  spent_cents integer default 0,
  -- 90/10 split: when a national promo runs on a store, the store earns
  -- store_revenue_share_pct of the spend. Default 10% per product decision.
  store_revenue_share_pct integer not null default 10
    check (store_revenue_share_pct between 0 and 50),

  -- Moderation
  status text not null default 'active'
    check (status in ('draft','pending_review','active','paused','ended','rejected')),
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_promotions_active
  on promotions (status, starts_at, ends_at)
  where status = 'active';
create index if not exists idx_promotions_store
  on promotions (store_id, status)
  where status = 'active';
create index if not exists idx_promotions_national_targeting
  on promotions (kind, status)
  where kind = 'national' and status = 'active';

-- Store-level opt-outs of national promos. Default is auto-show; a store
-- owner who doesn't want a particular national campaign inserts a row here.
create table if not exists promotion_opt_outs (
  promotion_id uuid not null references promotions(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  opted_out_at timestamptz not null default now(),
  opted_out_by uuid references users(id) on delete set null,
  reason text,
  primary key (promotion_id, store_id)
);

-- Impression/click/conversion events for reporting + billing (CPM/CPC).
create table if not exists promotion_events (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references promotions(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  event_type text not null check (event_type in ('impression','click','conversion')),
  placement text,
  session_id text,
  inventory_id uuid references inventory(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_promotion_events_reporting
  on promotion_events (promotion_id, event_type, created_at);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table promotions enable row level security;
alter table promotion_opt_outs enable row level security;
alter table promotion_events enable row level security;

-- Public read: any active promo in its window. The shop page is anon-accessible
-- so we need public SELECT on active rows only.
drop policy if exists promotions_public_read on promotions;
create policy promotions_public_read on promotions
  for select to anon, authenticated
  using (status = 'active' and now() between starts_at and ends_at);

-- Store owners/managers manage their own store-kind promos.
drop policy if exists promotions_store_crud on promotions;
create policy promotions_store_crud on promotions
  for all to authenticated
  using (
    kind = 'store'
    and store_id = current_store_id()
    and current_user_role() in ('owner','manager')
  )
  with check (
    kind = 'store'
    and store_id = current_store_id()
    and current_user_role() in ('owner','manager')
  );

-- National promos are inserted/updated by service role only (BevTek admin UI
-- uses a service-role server action). No RLS policy needed — service role
-- bypasses RLS. Authenticated users see national promos only via the public
-- read policy above.

-- Store owners can opt out of national promos that target their store.
drop policy if exists promotion_opt_outs_store on promotion_opt_outs;
create policy promotion_opt_outs_store on promotion_opt_outs
  for all to authenticated
  using (
    store_id = current_store_id()
    and current_user_role() in ('owner','manager')
  )
  with check (
    store_id = current_store_id()
    and current_user_role() in ('owner','manager')
  );

-- Events: public can INSERT (anon impressions on the shop page), but only
-- the platform reads them back. No SELECT policy = only service role reads.
drop policy if exists promotion_events_insert on promotion_events;
create policy promotion_events_insert on promotion_events
  for insert to anon, authenticated
  with check (true);

-- --------------------------------------------------------------------------
-- Helper view: active promos for a store, with inventory already joined.
-- Caller passes the store id; view resolves national-kind promos against
-- that store's inventory so "no match = no show" is automatic.
-- --------------------------------------------------------------------------
create or replace function active_promotions_for_store(p_store_id uuid)
returns table (
  id uuid,
  kind text,
  title text,
  tagline text,
  image_url text,
  cta_label text,
  cta_url text,
  priority integer,
  inventory_id uuid,
  inventory_name text,
  inventory_price numeric,
  inventory_image_url text,
  inventory_stock_qty integer,
  inventory_brand text,
  inventory_varietal text,
  inventory_summary text
)
language sql stable
as $$
  with candidates as (
    select p.*
    from promotions p
    where p.status = 'active'
      and now() between p.starts_at and p.ends_at
      and (
        -- store-kind: match the store directly
        (p.kind = 'store' and p.store_id = p_store_id)
        or
        -- national-kind: target this store and it hasn't opted out
        (
          p.kind = 'national'
          and (p.target_store_ids is null or p_store_id = any(p.target_store_ids))
          and not exists (
            select 1 from promotion_opt_outs o
            where o.promotion_id = p.id and o.store_id = p_store_id
          )
        )
      )
  )
  select
    c.id,
    c.kind,
    c.title,
    c.tagline,
    coalesce(c.image_url, i.image_url) as image_url,
    c.cta_label,
    c.cta_url,
    c.priority,
    i.id as inventory_id,
    i.name as inventory_name,
    i.price as inventory_price,
    i.image_url as inventory_image_url,
    i.stock_qty as inventory_stock_qty,
    i.brand as inventory_brand,
    i.varietal as inventory_varietal,
    i.summary_for_customer as inventory_summary
  from candidates c
  left join lateral (
    -- Resolve to a real inventory row in this store:
    --   1. store-kind: direct inventory_id link (already scoped to store)
    --   2. national-kind: match by UPC, then brand, then category
    select *
    from inventory inv
    where inv.store_id = p_store_id
      and inv.is_active is not false
      and inv.stock_qty > 0
      and (
        (c.kind = 'store' and inv.id = c.inventory_id)
        or (c.kind = 'national' and c.upc is not null and inv.upc = c.upc)
        or (c.kind = 'national' and c.brand is not null and inv.brand ilike c.brand)
        or (c.kind = 'national' and c.category is not null and inv.category = c.category)
      )
    order by
      -- Prefer exact UPC > brand > category matches; then highest stock
      case
        when c.upc is not null and inv.upc = c.upc then 1
        when c.brand is not null and inv.brand ilike c.brand then 2
        else 3
      end,
      inv.stock_qty desc
    limit 1
  ) i on true
  -- No match in this store = no show (keeps customers from clicking through
  -- to out-of-stock/nonexistent products).
  where i.id is not null
  order by c.priority desc, c.created_at desc;
$$;

grant execute on function active_promotions_for_store(uuid) to anon, authenticated;
