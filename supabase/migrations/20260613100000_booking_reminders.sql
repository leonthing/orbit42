-- Pre-meeting reminder bookkeeping: set once the 24h-before reminder
-- email has gone out so the hourly cron never double-sends.
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

create index if not exists idx_bookings_reminder_due
  on public.bookings (scheduled_at)
  where reminder_sent_at is null and status = 'confirmed';
