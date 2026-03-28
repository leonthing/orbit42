-- Add bio, education, interests to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS education jsonb DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}';
