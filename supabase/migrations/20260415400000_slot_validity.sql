-- Allow hosts to constrain when a slot is bookable (e.g. only for the
-- next month, a specific campaign window, one year, etc.). Both bounds
-- are optional — NULL means unbounded.

alter table public.time_slots
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz;

create index if not exists idx_time_slots_valid_until
  on public.time_slots(valid_until);
