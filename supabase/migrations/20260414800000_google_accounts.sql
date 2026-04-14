-- Additional Google accounts that a user can connect alongside their
-- primary (which stays on users.google_*). Each extra account has its
-- own refresh token and pulls its own calendars.
CREATE TABLE google_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text,
  access_token text,
  refresh_token text NOT NULL,
  token_expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX google_accounts_user_idx ON google_accounts (user_id);

-- When user_calendar_settings references a calendar from one of these
-- additional accounts, we can point back to it for refetch.
ALTER TABLE user_calendar_settings
  ADD COLUMN IF NOT EXISTS google_account_id uuid REFERENCES google_accounts(id) ON DELETE SET NULL;
