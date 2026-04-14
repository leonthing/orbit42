-- Follows: directional follow graph between users (a.k.a. "Orbits")
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows (following_id);

-- Per-Google-calendar visibility settings owned by each user.
CREATE TABLE IF NOT EXISTS user_calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'followers', 'public')),
  label_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_calendar_id)
);

CREATE INDEX IF NOT EXISTS user_calendar_settings_user_idx ON user_calendar_settings (user_id);
