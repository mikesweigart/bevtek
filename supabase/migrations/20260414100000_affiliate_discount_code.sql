-- Update affiliate program: each affiliate now gets a customer-facing
-- discount code (10% off) alongside their referral link. When a customer
-- uses the code at checkout, the affiliate earns 15% recurring for life.

alter table public.affiliates
  add column if not exists discount_code text unique,
  add column if not exists customer_discount_rate numeric(5,4) not null default 0.10;

-- Change commission default for new affiliates to 15%.
alter table public.affiliates
  alter column commission_rate set default 0.15;

-- Update existing affiliates who still have the old 30% default to 15%
-- (preserving any that an admin has explicitly customized is ideal, but
-- for a pre-launch system this is fine).
update public.affiliates set commission_rate = 0.15 where commission_rate = 0.30;

-- Regenerate the bootstrap RPC so new signups get a discount code too.
create or replace function public.create_affiliate_for_current_user(
  p_full_name text default null,
  p_payout_email text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_email        text;
  v_referral     text;
  v_discount     text;
  v_name_seed    text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.affiliates where id = v_user_id) then
    raise exception 'already an affiliate' using errcode = '23505';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  -- Referral code: lowercase 8-char random (URL-friendly).
  loop
    v_referral := lower(
      substr(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), '+', ''), 1, 8)
    );
    exit when not exists (select 1 from public.affiliates where referral_code = v_referral);
  end loop;

  -- Discount code: uppercase, based on full name or email local-part, + suffix.
  v_name_seed := coalesce(
    regexp_replace(upper(trim(split_part(p_full_name, ' ', 1))), '[^A-Z]', '', 'g'),
    ''
  );
  if length(v_name_seed) < 3 then
    v_name_seed := upper(regexp_replace(split_part(v_email, '@', 1), '[^a-z]', '', 'g'));
  end if;
  if length(v_name_seed) > 8 then
    v_name_seed := substring(v_name_seed, 1, 8);
  end if;
  if length(v_name_seed) = 0 then
    v_name_seed := 'SAVE';
  end if;

  -- Append 10 by convention (for the 10% discount), ensure uniqueness.
  v_discount := v_name_seed || '10';
  while exists (select 1 from public.affiliates where discount_code = v_discount) loop
    v_discount := v_name_seed || to_char((random() * 899 + 100)::int, 'FM000');
  end loop;

  insert into public.affiliates (
    id, email, full_name, referral_code, discount_code, payout_email
  ) values (
    v_user_id, v_email, nullif(trim(p_full_name), ''),
    v_referral, v_discount, nullif(trim(p_payout_email), '')
  );

  return json_build_object(
    'referral_code', v_referral,
    'discount_code', v_discount
  );
end;
$$;

revoke all on function public.create_affiliate_for_current_user(text, text) from public;
grant execute on function public.create_affiliate_for_current_user(text, text) to authenticated;

-- Backfill discount codes for any existing affiliates that don't have one.
do $$
declare
  r record;
  v_seed text;
  v_code text;
begin
  for r in select id, email, full_name from public.affiliates where discount_code is null loop
    v_seed := coalesce(
      regexp_replace(upper(trim(split_part(r.full_name, ' ', 1))), '[^A-Z]', '', 'g'),
      ''
    );
    if length(v_seed) < 3 then
      v_seed := upper(regexp_replace(split_part(r.email, '@', 1), '[^a-z]', '', 'g'));
    end if;
    if length(v_seed) > 8 then v_seed := substring(v_seed, 1, 8); end if;
    if length(v_seed) = 0 then v_seed := 'SAVE'; end if;
    v_code := v_seed || '10';
    while exists (select 1 from public.affiliates where discount_code = v_code) loop
      v_code := v_seed || to_char((random() * 899 + 100)::int, 'FM000');
    end loop;
    update public.affiliates set discount_code = v_code where id = r.id;
  end loop;
end $$;
