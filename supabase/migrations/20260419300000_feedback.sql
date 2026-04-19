-- User feedback: lightweight inbox for bug reports / feature requests /
-- general notes. Logged-out users can still submit (email optional).

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  email text,
  body text NOT NULL,
  path text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (char_length(body) > 0 AND char_length(body) <= 4000)
);

CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_unresolved_idx
  ON feedback (created_at DESC) WHERE resolved_at IS NULL;
