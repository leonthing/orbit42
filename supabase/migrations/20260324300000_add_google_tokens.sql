-- Add Google Calendar OAuth tokens to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expiry timestamptz;
