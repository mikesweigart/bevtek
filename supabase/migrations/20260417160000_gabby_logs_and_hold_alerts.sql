-- Gabby conversation log + hold alert bookkeeping.
-- Enables the owner "Conversations" page (shows real customer chats) and
-- lets us email the owner once per new hold without double-sending.

-- ---------------------------------------------------------------------------
-- Gabby conversations: one row per customer turn, grouped by session_id
-- so the owner UI can stitch a thread back together.
-- ---------------------------------------------------------------------------
create table if not exists public.gabby_conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id text not null,                      -- client-generated, groups a chat thread
  user_message text not null,
  assistant_message text not null,
  inventory_count int not null default 0,        -- how many products Gabby saw
  created_at timestamptz not null default now()
);

create index if not exists gabby_conversations_store_created_idx
  on public.gabby_conversations (store_id, created_at desc);

create index if not exists gabby_conversations_session_idx
  on public.gabby_conversations (session_id, created_at);

alter table public.gabby_conversations enable row level security;

-- Owners + managers of the store can read their own store's chats.
drop policy if exists "store_staff_read_gabby_convos" on public.gabby_conversations;
create policy "store_staff_read_gabby_convos"
  on public.gabby_conversations
  for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.store_id = gabby_conversations.store_id
        and u.role in ('owner','manager','staff')
    )
  );

-- Only server-side (service role) writes. No insert policy for authed users.

-- ---------------------------------------------------------------------------
-- Hold notification bookkeeping: a column so we never double-email the
-- owner when they refresh the Holds page.
-- ---------------------------------------------------------------------------
alter table public.hold_requests
  add column if not exists owner_notified_at timestamptz;

-- Track which teammate handed the item to the customer (mirrors confirmed_by).
alter table public.hold_requests
  add column if not exists picked_up_by uuid references public.users(id) on delete set null;

create index if not exists hold_requests_pending_notification_idx
  on public.hold_requests (store_id, created_at)
  where owner_notified_at is null;
