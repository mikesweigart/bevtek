-- Megan Trainer gamification — roadmap priority #1.
--
-- Rework:
--   modules    — add category_group, position, star_reward, is_seed; allow
--                store_id = null (seed modules bundled with BevTek).
--   progress   — add stars_earned, best_score, attempts, last_attempt_at.
--   quiz_questions (new)       — 2 questions per module, JSON options.
--   user_gamification (new)    — total stars, streak, last_active_date.
--
-- Levels are derived from total_stars:
--   Newcomer 0-9, Apprentice 10-29, Sommelier 30-59, Expert 60-99, Elite 100+.

-- ---------------------------------------------------------------------------
-- modules extensions
-- ---------------------------------------------------------------------------

alter table public.modules
  add column if not exists category_group text,  -- wine_france|wine_usa|wine_world|spirits|beer|cocktails|custom
  add column if not exists position int not null default 0,
  add column if not exists star_reward int not null default 2,
  add column if not exists is_seed boolean not null default false;

-- Allow seed modules (no specific store_id).
alter table public.modules alter column store_id drop not null;

-- Update select policy so seeds (store_id is null) are visible to everyone.
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
  for select to authenticated
  using (store_id is null or store_id = public.current_store_id());

-- Write policy stays as-is: managers/owners can only write to their own store
-- rows. Seeds are read-only from the app (managed via migrations).

-- ---------------------------------------------------------------------------
-- quiz_questions
-- ---------------------------------------------------------------------------

create table if not exists public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  module_id     uuid not null references public.modules(id) on delete cascade,
  position      int not null default 0,
  question      text not null,
  options       jsonb not null,  -- array of 4 strings
  correct_index int not null check (correct_index between 0 and 3),
  explanation   text,
  created_at    timestamptz not null default now()
);
create index quiz_questions_module_idx
  on public.quiz_questions(module_id, position);

alter table public.quiz_questions enable row level security;

-- Read if the underlying module is readable to the user.
drop policy if exists quiz_questions_select on public.quiz_questions;
create policy quiz_questions_select on public.quiz_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      where m.id = quiz_questions.module_id
        and (m.store_id is null or m.store_id = public.current_store_id())
    )
  );

-- ---------------------------------------------------------------------------
-- progress extensions
-- ---------------------------------------------------------------------------

alter table public.progress
  add column if not exists stars_earned int not null default 0,
  add column if not exists best_score numeric,
  add column if not exists attempts int not null default 0,
  add column if not exists last_attempt_at timestamptz;

-- ---------------------------------------------------------------------------
-- user_gamification
-- ---------------------------------------------------------------------------

create table if not exists public.user_gamification (
  id                     uuid primary key references public.users(id) on delete cascade,
  total_stars            int not null default 0,
  current_streak_days    int not null default 0,
  longest_streak_days    int not null default 0,
  last_active_date       date,
  updated_at             timestamptz not null default now()
);

alter table public.user_gamification enable row level security;

-- Users see their own row; managers see team rows in their store.
drop policy if exists user_gamification_select on public.user_gamification;
create policy user_gamification_select on public.user_gamification
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.users me
      join public.users them on them.store_id = me.store_id
      where me.id = auth.uid()
        and me.role in ('owner','manager')
        and them.id = user_gamification.id
    )
  );

-- Self-upsert for a user's own row (progress triggers insert it).
drop policy if exists user_gamification_self on public.user_gamification;
create policy user_gamification_self on public.user_gamification
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- submit_quiz_attempt RPC
-- Called from the quiz UI with the user's answer indices for all questions
-- on a module. Returns the score (0-1), stars awarded, and pass/fail.
-- ---------------------------------------------------------------------------

create or replace function public.submit_quiz_attempt(
  p_module_id uuid,
  p_answers   int[]  -- index per question, in question.position order
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_store_id     uuid;
  v_star_reward  int;
  v_total_qs     int;
  v_correct      int := 0;
  v_score        numeric;
  v_stars        int;
  v_passed       boolean;
  v_prev_best    numeric;
  v_prev_stars   int;
  v_today        date := current_date;
  v_prev_active  date;
  v_streak       int;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Resolve store_id from user.
  select store_id into v_store_id from public.users where id = v_user_id;
  if v_store_id is null then
    raise exception 'no store' using errcode = '42501';
  end if;

  -- Module must exist and be readable.
  select star_reward into v_star_reward from public.modules
  where id = p_module_id
    and (store_id is null or store_id = v_store_id);
  if v_star_reward is null then
    raise exception 'module not found' using errcode = '22023';
  end if;

  -- Count correct answers.
  select count(*) into v_total_qs from public.quiz_questions where module_id = p_module_id;
  if v_total_qs = 0 then
    raise exception 'module has no quiz' using errcode = '22023';
  end if;
  if array_length(p_answers, 1) <> v_total_qs then
    raise exception 'wrong number of answers' using errcode = '22023';
  end if;

  select count(*) into v_correct
  from (
    select q.correct_index, p_answers[q.position + 1] as given
    from public.quiz_questions q
    where q.module_id = p_module_id
  ) t
  where t.correct_index = t.given;

  v_score := v_correct::numeric / v_total_qs;
  v_passed := v_score >= 1.0;       -- must be perfect to earn stars (2-question quizzes)
  v_stars  := case when v_passed then v_star_reward else 0 end;

  -- Previous progress for this user+module.
  select best_score, stars_earned into v_prev_best, v_prev_stars
  from public.progress where user_id = v_user_id and module_id = p_module_id;

  insert into public.progress (
    store_id, user_id, module_id, status,
    score, best_score, stars_earned, attempts,
    started_at, completed_at, last_attempt_at, updated_at
  ) values (
    v_store_id, v_user_id, p_module_id,
    case when v_passed then 'completed' else 'in_progress' end,
    v_score,
    greatest(coalesce(v_prev_best, 0), v_score),
    greatest(coalesce(v_prev_stars, 0), v_stars),
    1,
    now(),
    case when v_passed then now() else null end,
    now(),
    now()
  )
  on conflict (user_id, module_id) do update set
    status        = case when v_passed then 'completed' else public.progress.status end,
    score         = v_score,
    best_score    = greatest(coalesce(public.progress.best_score, 0), v_score),
    stars_earned  = greatest(public.progress.stars_earned, v_stars),
    attempts      = public.progress.attempts + 1,
    completed_at  = case when v_passed and public.progress.completed_at is null
                         then now() else public.progress.completed_at end,
    last_attempt_at = now(),
    updated_at    = now();

  -- Gamification update — only award new stars if this attempt beat previous best.
  if v_stars > coalesce(v_prev_stars, 0) then
    insert into public.user_gamification (id, total_stars, current_streak_days,
                                          longest_streak_days, last_active_date, updated_at)
    values (v_user_id, v_stars - coalesce(v_prev_stars, 0), 1, 1, v_today, now())
    on conflict (id) do update set
      total_stars        = user_gamification.total_stars + (v_stars - coalesce(v_prev_stars, 0)),
      last_active_date   = v_today,
      updated_at         = now();
  end if;

  -- Streak logic — runs regardless of pass/fail, just "did they engage today".
  select last_active_date into v_prev_active
  from public.user_gamification where id = v_user_id;

  if v_prev_active is null or v_prev_active < v_today - 1 then
    v_streak := 1;
  elsif v_prev_active = v_today - 1 then
    select current_streak_days + 1 into v_streak
    from public.user_gamification where id = v_user_id;
  else  -- v_prev_active = v_today  → same-day attempt, preserve streak
    select current_streak_days into v_streak
    from public.user_gamification where id = v_user_id;
    if v_streak = 0 then v_streak := 1; end if;
  end if;

  insert into public.user_gamification (id, current_streak_days, longest_streak_days,
                                        last_active_date, updated_at)
  values (v_user_id, v_streak, v_streak, v_today, now())
  on conflict (id) do update set
    current_streak_days  = v_streak,
    longest_streak_days  = greatest(user_gamification.longest_streak_days, v_streak),
    last_active_date     = v_today,
    updated_at           = now();

  return json_build_object(
    'score',        v_score,
    'correct',      v_correct,
    'total',        v_total_qs,
    'passed',       v_passed,
    'stars_awarded', v_stars,
    'stars_new',    greatest(0, v_stars - coalesce(v_prev_stars, 0))
  );
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, int[]) from public;
grant execute on function public.submit_quiz_attempt(uuid, int[]) to authenticated;
