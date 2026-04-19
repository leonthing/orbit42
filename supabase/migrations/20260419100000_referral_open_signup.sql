-- Open signup: the invite code is no longer a gate — it becomes an
-- optional referral code. We still want to know who referred whom,
-- so persist the inviter on the user row.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invited_by_user_id uuid
    REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_invited_by_idx
  ON users (invited_by_user_id);

-- Backfill from existing invite_codes: whoever claimed a code was
-- invited by that code's creator. Only touches users that don't
-- already have a referrer set.
UPDATE users u
SET invited_by_user_id = ic.creator_id
FROM invite_codes ic
WHERE ic.used_by = u.id
  AND u.invited_by_user_id IS NULL
  AND ic.creator_id <> u.id;
