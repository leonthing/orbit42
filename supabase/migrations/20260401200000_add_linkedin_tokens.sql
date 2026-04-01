ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_access_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_refresh_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_token_expiry timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_sub text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_name text;
