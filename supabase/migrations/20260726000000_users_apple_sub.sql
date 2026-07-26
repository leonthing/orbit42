-- Sign in with Apple: store Apple's stable subject identifier so we can
-- match returning users even when their email is a private relay address.
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub text;

CREATE UNIQUE INDEX IF NOT EXISTS users_apple_sub_idx
  ON users (apple_sub)
  WHERE apple_sub IS NOT NULL;
