-- Per-user notification preferences.
--
-- Row exists only when the user has opted out of at least one
-- channel/type combination. Default (no row) = everything on.

create table if not exists public.notification_prefs (
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  in_app boolean not null default true,
  email boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

alter table public.notification_prefs enable row level security;
