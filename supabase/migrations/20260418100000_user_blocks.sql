-- User blocks. Blocked users can't start conversations, send messages,
-- or interact via follow/comment/reaction with the blocker.

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;
