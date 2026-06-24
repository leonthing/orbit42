-- The legacy `comments` table (post_slug/author/content) predates the current
-- post_comments system and is no longer referenced by any application code.
-- Its original policies allowed the anon key to read and insert freely
-- (USING/ WITH CHECK true), which is an open write vector via PostgREST.
-- Drop the public policies so RLS falls back to default-deny; the server-side
-- service role still bypasses RLS for any cleanup needs. The table and its
-- data are left intact (no DROP) in case anything still needs to be migrated.

DROP POLICY IF EXISTS "Public can read comments" ON comments;
DROP POLICY IF EXISTS "Public can insert comments" ON comments;
DROP POLICY IF EXISTS "Service role can delete comments" ON comments;
