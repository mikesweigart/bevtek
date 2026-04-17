-- Demo staff for leaderboard — so prospect demos look populated.
-- Creates 8 fake staff members in the first store (or a store named 'Grapes & Grains'
-- if it exists), with realistic names, levels, and star counts.
-- Marked is_demo=true so they can be cleaned up later.
--
-- Safe to re-run: uses upsert by email. Won't duplicate.

-- 1. Add is_demo flag to user_gamification so we can filter/clean up
alter table public.user_gamification
  add column if not exists is_demo boolean not null default false;

-- 2. Add is_demo flag to users
alter table public.users
  add column if not exists is_demo boolean not null default false;

-- 3. Seed demo users
do $$
declare
  target_store_id uuid;
  demo_auth_id uuid;
  demo_user record;
  demo_data jsonb := '[
    {"email": "sarah.chen@demo.bevtek.ai", "name": "Sarah Chen", "stars": 287, "streak": 12, "role": "staff"},
    {"email": "marcus.williams@demo.bevtek.ai", "name": "Marcus Williams", "stars": 241, "streak": 8, "role": "staff"},
    {"email": "priya.patel@demo.bevtek.ai", "name": "Priya Patel", "stars": 198, "streak": 15, "role": "manager"},
    {"email": "james.oconnor@demo.bevtek.ai", "name": "James OConnor", "stars": 164, "streak": 5, "role": "staff"},
    {"email": "elena.rodriguez@demo.bevtek.ai", "name": "Elena Rodriguez", "stars": 132, "streak": 3, "role": "staff"},
    {"email": "tyler.brooks@demo.bevtek.ai", "name": "Tyler Brooks", "stars": 98, "streak": 7, "role": "staff"},
    {"email": "ava.thompson@demo.bevtek.ai", "name": "Ava Thompson", "stars": 74, "streak": 2, "role": "staff"},
    {"email": "noah.kim@demo.bevtek.ai", "name": "Noah Kim", "stars": 41, "streak": 1, "role": "staff"}
  ]'::jsonb;
begin
  -- Find target store: prefer demo store, else first one
  select id into target_store_id
  from public.stores
  where lower(name) like '%grapes%grains%'
     or lower(name) like '%demo%'
  order by created_at asc
  limit 1;

  if target_store_id is null then
    select id into target_store_id from public.stores order by created_at asc limit 1;
  end if;

  if target_store_id is null then
    raise notice 'No stores found — skipping demo leaderboard seed.';
    return;
  end if;

  -- Create each demo user
  for demo_user in select * from jsonb_array_elements(demo_data) loop
    declare
      rec jsonb := demo_user.value;
      u_email text := rec->>'email';
      u_name text := rec->>'name';
      u_stars int := (rec->>'stars')::int;
      u_streak int := (rec->>'streak')::int;
      u_role text := rec->>'role';
      existing_auth_id uuid;
      new_auth_id uuid;
    begin
      -- Check if auth user already exists
      select id into existing_auth_id from auth.users where email = u_email;

      if existing_auth_id is null then
        -- Create auth user
        new_auth_id := gen_random_uuid();
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data,
          is_super_admin, is_sso_user
        ) values (
          '00000000-0000-0000-0000-000000000000',
          new_auth_id,
          'authenticated',
          'authenticated',
          u_email,
          crypt('demo-password-not-used', gen_salt('bf')),
          now(),
          now(),
          now(),
          '{"provider":"email","providers":["email"],"is_demo":true}'::jsonb,
          jsonb_build_object('full_name', u_name, 'is_demo', true),
          false,
          false
        );
      else
        new_auth_id := existing_auth_id;
      end if;

      -- Upsert public.users profile
      insert into public.users (id, email, full_name, role, store_id, is_demo)
      values (new_auth_id, u_email, u_name, u_role, target_store_id, true)
      on conflict (id) do update set
        full_name = excluded.full_name,
        role = excluded.role,
        store_id = excluded.store_id,
        is_demo = true;

      -- Upsert gamification (stars, streak)
      insert into public.user_gamification (
        id, total_stars, current_streak_days, longest_streak_days, is_demo
      ) values (
        new_auth_id, u_stars, u_streak, u_streak + 3, true
      )
      on conflict (id) do update set
        total_stars = excluded.total_stars,
        current_streak_days = excluded.current_streak_days,
        longest_streak_days = excluded.longest_streak_days,
        is_demo = true;
    end;
  end loop;

  raise notice 'Demo leaderboard seeded for store %', target_store_id;
end $$;
