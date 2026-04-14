-- Native orbit42 calendars: users can create calendars inside our app
-- without requiring Google at all. Google integration becomes optional —
-- a Google calendar is just a calendar row with source='google'.

CREATE TABLE calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  purpose text CHECK (
    purpose IS NULL OR purpose IN ('personal','work','couple','income','hobby','other')
  ),
  color text NOT NULL DEFAULT '#6366f1',
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','followers','public')),
  source text NOT NULL DEFAULT 'native'
    CHECK (source IN ('native','google')),
  google_calendar_id text,
  google_account_id uuid REFERENCES google_accounts(id) ON DELETE SET NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, google_calendar_id)
);

CREATE INDEX calendars_user_idx ON calendars (user_id);
CREATE INDEX calendars_vis_idx ON calendars (user_id, visibility);

-- Seed a default native calendar for every existing user.
INSERT INTO calendars (user_id, name, purpose, color, visibility, source, is_default)
SELECT id, '내 캘린더', 'personal', '#6366f1', 'private', 'native', true
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM calendars c WHERE c.user_id = users.id AND c.is_default = true
);

-- Migrate previously-registered Google calendars into this table.
INSERT INTO calendars (
  user_id, name, purpose, color, visibility, source, google_calendar_id
)
SELECT
  ucs.user_id,
  COALESCE(NULLIF(ucs.label_override, ''), 'Google Calendar'),
  ucs.purpose,
  COALESCE(NULLIF(ucs.color_override, ''), '#4285f4'),
  ucs.visibility,
  'google',
  ucs.google_calendar_id
FROM user_calendar_settings ucs
ON CONFLICT (user_id, source, google_calendar_id) DO NOTHING;

-- Events get a calendar_id. Backfill to each user's default calendar.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS calendar_id uuid REFERENCES calendars(id) ON DELETE CASCADE;

UPDATE events e
SET calendar_id = (
  SELECT id FROM calendars
  WHERE user_id = e.user_id AND is_default = true
  LIMIT 1
)
WHERE calendar_id IS NULL;

CREATE INDEX IF NOT EXISTS events_calendar_idx ON events (calendar_id, start_at);
