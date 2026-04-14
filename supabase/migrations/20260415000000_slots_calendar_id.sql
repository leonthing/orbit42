-- Associate each slot with one of the host's calendars, so its bookings
-- land on the chosen calendar and its visibility inherits from that
-- calendar. Backfills to the host's default calendar.

alter table public.time_slots
  add column if not exists calendar_id uuid references public.calendars(id) on delete set null;

update public.time_slots ts
set calendar_id = c.id
from public.calendars c
where ts.calendar_id is null
  and c.user_id = ts.host_id
  and c.is_default = true;

create index if not exists idx_time_slots_calendar_id on public.time_slots(calendar_id);
