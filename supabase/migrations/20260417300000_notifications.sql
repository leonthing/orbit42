-- In-app notifications.
--
-- Each notification is a single row per recipient. Type lets the UI
-- render an icon; link points to the relevant page. read_at nulls
-- out until the user clicks it (or "mark all read").

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  actor_id uuid references public.users(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at);

alter table public.notifications enable row level security;
