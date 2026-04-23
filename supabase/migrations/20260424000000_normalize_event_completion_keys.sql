-- Normalize event_completions.event_key so month and week views share keys.
--
-- Before: month view stored `UUID` / `gcal_<itemId>`, week view stored
-- `native:<uuid>` / `<gcalId>::<itemId>`. Because the two formats never
-- collided in the DB, toggling completion in one view didn't appear in the
-- other. We now standardize on `local:<uuid>` / `google:<itemId>`.
--
-- `event_key` has `(user_id, event_key)` as a unique composite; to avoid
-- collisions when both old formats point at the same event, we delete
-- losers before updating.

BEGIN;

-- 1. Google: `gcal_<itemId>` → `google:<itemId>`
DELETE FROM event_completions a
USING event_completions b
WHERE a.user_id = b.user_id
  AND a.event_key LIKE 'gcal\_%'
  AND b.event_key = 'google:' || substring(a.event_key from 6);

UPDATE event_completions
SET event_key = 'google:' || substring(event_key from 6)
WHERE event_key LIKE 'gcal\_%';

-- 2. Google: `<gcalId>::<itemId>` → `google:<itemId>`
DELETE FROM event_completions a
USING event_completions b
WHERE a.user_id = b.user_id
  AND a.event_key LIKE '%::%'
  AND a.event_key NOT LIKE 'google:%'
  AND a.event_key NOT LIKE 'local:%'
  AND b.event_key = 'google:' || split_part(a.event_key, '::', 2);

UPDATE event_completions
SET event_key = 'google:' || split_part(event_key, '::', 2)
WHERE event_key LIKE '%::%'
  AND event_key NOT LIKE 'google:%'
  AND event_key NOT LIKE 'local:%';

-- 3. Native: `native:<uuid>` → `local:<uuid>`
DELETE FROM event_completions a
USING event_completions b
WHERE a.user_id = b.user_id
  AND a.event_key LIKE 'native:%'
  AND b.event_key = 'local:' || substring(a.event_key from 8);

UPDATE event_completions
SET event_key = 'local:' || substring(event_key from 8)
WHERE event_key LIKE 'native:%';

-- 4. Bare UUID (month-view local) → `local:<uuid>`
--    Match on UUID shape so we don't touch any already-prefixed keys.
UPDATE event_completions
SET event_key = 'local:' || event_key
WHERE event_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

COMMIT;
