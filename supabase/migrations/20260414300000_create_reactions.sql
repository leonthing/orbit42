-- Universal reactions: emoji reactions on events, slots, blog posts.
-- target_id is text (not uuid) because Google Calendar event ids are not uuids;
-- callers encode their own id space (e.g. "post:<uuid>", "slot:<uuid>",
-- "event:<calendar_id>::<gcal_event_id>").
CREATE TABLE reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('event', 'post', 'slot')),
  target_id text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id, emoji)
);

CREATE INDEX reactions_target_idx ON reactions (target_type, target_id);
CREATE INDEX reactions_user_idx ON reactions (user_id);
