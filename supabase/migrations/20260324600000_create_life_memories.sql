CREATE TABLE life_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year int NOT NULL,
  week int NOT NULL,
  title text NOT NULL,
  content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year, week)
);

ALTER TABLE life_memories ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_life_memories_user ON life_memories(user_id);
