-- Marketplace trust + reverse market.

-- Guest reviews on completed bookings. One review per booking.
create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete cascade,
  host_id uuid not null references public.users(id) on delete cascade,
  slot_id uuid references public.time_slots(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique (booking_id)
);

create index if not exists booking_reviews_host_idx
  on public.booking_reviews(host_id, created_at desc);

alter table public.booking_reviews enable row level security;

-- Time requests: a guest asks a host to open time ("이런 시간 열어주세요").
-- Host accepts by picking a concrete time, which becomes a booking.
create table if not exists public.time_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  host_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  duration_min int not null default 60,
  budget_cents int,
  preferred_times text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'canceled')),
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_requests_host_idx
  on public.time_requests(host_id, status, created_at desc);
create index if not exists time_requests_requester_idx
  on public.time_requests(requester_id, created_at desc);

alter table public.time_requests enable row level security;
