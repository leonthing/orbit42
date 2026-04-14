-- Lightweight microposts for the social feed (text + media + location +
-- optional attachment). Long-form blog posts stay in blog_posts.
CREATE TABLE feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  image_urls text[] NOT NULL DEFAULT '{}',
  location_label text,
  attached_event_id text,           -- e.g. "{calendar_id}::{gcal_event_id}"
  attached_slot_id uuid REFERENCES time_slots(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feed_posts_user_idx ON feed_posts (user_id, created_at DESC);
CREATE INDEX feed_posts_created_idx ON feed_posts (created_at DESC);

-- Allow reactions to target this new content type
ALTER TABLE reactions
  DROP CONSTRAINT IF EXISTS reactions_target_type_check;
ALTER TABLE reactions
  ADD CONSTRAINT reactions_target_type_check
  CHECK (target_type IN ('event', 'post', 'slot', 'feed_post'));

-- Storage bucket for feed media
INSERT INTO storage.buckets (id, name, public)
VALUES ('feed-media', 'feed-media', true)
ON CONFLICT (id) DO NOTHING;
