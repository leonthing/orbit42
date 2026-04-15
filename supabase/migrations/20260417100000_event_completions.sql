-- Per-user completion marks on calendar events.
--
-- Works for both native events (UUID) and Google events (prefixed
-- string id like "gcal_..."), so we store the key as text instead of
-- referencing events.id.

create table if not exists public.event_completions (
  user_id uuid not null references public.users(id) on delete cascade,
  event_key text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, event_key)
);

create index if not exists event_completions_user_idx
  on public.event_completions(user_id);

alter table public.event_completions enable row level security;
