-- Menu library: reusable add-on items (skills, services, menus) a host
-- can attach to slots. Guests pick from these when booking.

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  category text,
  description text,
  price_cents integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_menus_user_id on public.menus(user_id);

-- Many-to-many between slots and menus.
create table if not exists public.slot_menus (
  slot_id uuid not null references public.time_slots(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (slot_id, menu_id)
);
create index if not exists idx_slot_menus_slot on public.slot_menus(slot_id);
create index if not exists idx_slot_menus_menu on public.slot_menus(menu_id);

-- Snapshot of menu selections at booking time.
alter table public.bookings
  add column if not exists selected_menu_ids uuid[] not null default '{}';
