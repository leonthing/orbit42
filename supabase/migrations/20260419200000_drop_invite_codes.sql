-- Invite codes are replaced by @username-based referrals.
-- All reads have been removed from the app; drop the table and
-- the companion RPC.

DROP TABLE IF EXISTS invite_codes CASCADE;
DROP FUNCTION IF EXISTS generate_invite_codes(uuid, integer);
