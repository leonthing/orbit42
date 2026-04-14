-- Auto-mode for slots: instead of explicit availabilities, derive from
-- working hours + Google Calendar free/busy.
ALTER TABLE time_slots
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'manual'
    CHECK (mode IN ('manual', 'auto')),
  ADD COLUMN IF NOT EXISTS working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS slot_interval_min integer NOT NULL DEFAULT 30
    CHECK (slot_interval_min >= 5 AND slot_interval_min <= 240),
  ADD COLUMN IF NOT EXISTS min_notice_hours integer NOT NULL DEFAULT 4
    CHECK (min_notice_hours >= 0),
  ADD COLUMN IF NOT EXISTS max_advance_days integer NOT NULL DEFAULT 30
    CHECK (max_advance_days > 0 AND max_advance_days <= 365),
  ADD COLUMN IF NOT EXISTS buffer_min integer NOT NULL DEFAULT 0
    CHECK (buffer_min >= 0);

-- For auto bookings we don't need a pre-created availability row,
-- so the foreign key becomes optional.
ALTER TABLE bookings
  ALTER COLUMN availability_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS google_event_id text;
