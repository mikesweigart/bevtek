-- Affiliate program: partners who refer store owners and earn commission.
-- Separate from public.users (stores). A single auth.users account can be
-- both a store member AND an affiliate, but they're tracked independently.

create table public.affiliates (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  referral_code   text not null unique,
  commission_rate numeric(5,4) not null default 0.30, -- 30% default
  payout_email    text,
  stripe_account_id text,  -- for future Stripe Connect payouts
  status          text not null default 'active'
    check (status in ('active','paused','banned')),
  created_at      timestamptz not null default now()
);

create index affiliates_referral_code_idx on public.affiliates(referral_code);
create index affiliates_email_idx on public.affiliates(email);

-- Attribution log — record every click on a ?ref= referral link.
-- Later we'll join this to signups to calculate conversions.
create table public.affiliate_clicks (
  id            uuid primary key default gen_random_uuid(),
  referral_code text not null,
  ip_hash       text,         -- hashed client IP (for dedup without PII)
  user_agent    text,
  landing_path  text,
  referrer      text,
  created_at    timestamptz not null default now()
);

create index affiliate_clicks_code_idx on public.affiliate_clicks(referral_code, created_at desc);

-- Conversions — a store created by a referred user.
create table public.affiliate_conversions (
  id            uuid primary key default gen_random_uuid(),
  referral_code text not null,
  store_id      uuid not null references public.stores(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (store_id)
);

create index affiliate_conversions_code_idx on public.affiliate_conversions(referral_code, created_at desc);

alter table public.affiliates            enable row level security;
alter table public.affiliate_clicks      enable row level security;
alter table public.affiliate_conversions enable row level security;

-- Affiliate can read their own row and their clicks/conversions.
create policy affiliates_self_select on public.affiliates
  for select to authenticated using (id = auth.uid());

create policy affiliates_self_update on public.affiliates
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy affiliate_clicks_self on public.affiliate_clicks
  for select to authenticated
  using (referral_code in (select referral_code from public.affiliates where id = auth.uid()));

create policy affiliate_conversions_self on public.affiliate_conversions
  for select to authenticated
  using (referral_code in (select referral_code from public.affiliates where id = auth.uid()));

-- RPC to bootstrap an affiliate row. Called from /affiliates/signup after
-- the auth user is created. Generates a random referral code.
create or replace function public.create_affiliate_for_current_user(
  p_full_name text default null,
  p_payout_email text default null
) returns text   -- returns the generated referral code
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email   text;
  v_code    text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.affiliates where id = v_user_id) then
    raise exception 'already an affiliate' using errcode = '23505';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  -- Generate a short readable code, unique.
  loop
    v_code := lower(
      substr(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), '+', ''), 1, 8)
    );
    exit when not exists (select 1 from public.affiliates where referral_code = v_code);
  end loop;

  insert into public.affiliates (id, email, full_name, referral_code, payout_email)
  values (v_user_id, v_email, nullif(trim(p_full_name), ''), v_code, nullif(trim(p_payout_email), ''));

  return v_code;
end;
$$;

revoke all on function public.create_affiliate_for_current_user(text, text) from public;
grant execute on function public.create_affiliate_for_current_user(text, text) to authenticated;

-- Log a click (anonymous, rate-limit-friendly).
create or replace function public.log_affiliate_click(
  p_code text,
  p_ip_hash text default null,
  p_user_agent text default null,
  p_landing_path text default null,
  p_referrer text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only log if the code exists.
  if exists (select 1 from public.affiliates where referral_code = p_code and status = 'active') then
    insert into public.affiliate_clicks (referral_code, ip_hash, user_agent, landing_path, referrer)
    values (p_code, p_ip_hash, p_user_agent, p_landing_path, p_referrer);
  end if;
end;
$$;

revoke all on function public.log_affiliate_click(text, text, text, text, text) from public;
grant execute on function public.log_affiliate_click(text, text, text, text, text) to anon, authenticated;
