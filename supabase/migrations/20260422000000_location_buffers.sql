-- Location-aware travel buffers. Each user defines presets like
--   (강남, 30min, aliases [강남구, gangnam])
-- and slot-availability picks a per-event buffer by matching the
-- event's location (or title) against these keywords.

CREATE TABLE IF NOT EXISTS location_buffers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  buffer_min integer NOT NULL CHECK (buffer_min >= 0 AND buffer_min <= 720),
  aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS location_buffers_user_idx
  ON location_buffers (user_id);
