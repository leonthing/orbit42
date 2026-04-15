-- 1:1 messaging between users.
--
-- A conversation is uniquely identified by a normalized (user_a, user_b)
-- pair, where user_a.id < user_b.id. This gives us a single row per
-- pair and a cheap uniqueness constraint.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users(id) on delete cascade,
  user_b uuid not null references public.users(id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid references public.users(id) on delete set null,
  a_last_read_at timestamptz,
  b_last_read_at timestamptz,
  a_last_notified_at timestamptz,
  b_last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_user_order check (user_a < user_b),
  constraint conversations_unique_pair unique (user_a, user_b)
);

create index if not exists conversations_user_a_idx
  on public.conversations(user_a, last_message_at desc);
create index if not exists conversations_user_b_idx
  on public.conversations(user_b, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages(conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
