-- X (Twitter) OAuth tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS x_access_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS x_refresh_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS x_token_expiry timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS x_username text;

-- Facebook OAuth tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS fb_access_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fb_page_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fb_page_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fb_user_name text;
