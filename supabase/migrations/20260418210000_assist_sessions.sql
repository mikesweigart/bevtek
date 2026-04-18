-- Assist sessions — in-aisle QR hand-off.
--
-- An employee talks to Gabby on their device while standing with a
-- customer, then taps "Hand to customer" which materialises this row
-- and shows a QR code. The customer scans it on their own phone, lands
-- on a public continuation page, and keeps the conversation going
-- without rebuilding context. Employees on the floor asked for this;
-- it solves the "can I have your phone for a second" awkwardness.
--
-- Public-read by session id only (unguessable UUID). RLS blocks listing
-- or tampering. Two-hour TTL on the session — plenty for a shopping
-- visit, short enough that an abandoned phone doesn't leak forever.

create table if not exists public.assist_sessions (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  employee_id   uuid references public.users(id) on delete set null,
  messages      jsonb not null default '[]'::jsonb,
  status        text not null default 'active'
    check (status in ('active','handed_off','expired','ended')),
  created_at    timestamptz not null default now(),
  handed_off_at timestamptz,
  last_activity timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '2 hours')
);

create index if not exists assist_sessions_store_idx
  on public.assist_sessions(store_id, created_at desc);
create index if not exists assist_sessions_expires_idx
  on public.assist_sessions(expires_at)
  where status in ('active','handed_off');

alter table public.assist_sessions enable row level security;

-- Employees can create and read their own store's sessions while on shift.
drop policy if exists assist_sessions_employee_rw on public.assist_sessions;
create policy assist_sessions_employee_rw on public.assist_sessions
  for all
  using (
    auth.uid() is not null
    and store_id in (
      select u.store_id from public.users u where u.id = auth.uid()
    )
  )
  with check (
    auth.uid() is not null
    and store_id in (
      select u.store_id from public.users u where u.id = auth.uid()
    )
  );

-- Public continuation: the customer hits a server route with the
-- session id. The SERVER uses the service-role key (already used for
-- promotions + admin writes), so no anon read policy is needed — the
-- id acts as an unguessable capability token and the API route owns
-- expiry enforcement.
-- (Intentionally no anon SELECT policy.)

comment on table public.assist_sessions is
  'Per-request Gabby hand-off sessions so an employee can pass an in-progress chat to the customer via QR. Two-hour TTL; session id is the capability token.';
