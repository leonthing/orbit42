-- A stray `notifications_type_check` constraint (added out-of-band — it never
-- existed in these migrations; the original table used a plain `type text`)
-- rejected every notification type the app currently emits, allowing only a
-- legacy 'follow' value. Result: createNotification() inserts failed the CHECK
-- and were swallowed by its try/catch, so NO in-app notifications were ever
-- stored — booking_received, new_message, new_follower, comment_received, etc.
--
-- Restore the original design: a plain text type, with the allowed set enforced
-- in app code (src/lib/notifications-types.ts). Dropping (rather than re-adding
-- a stricter allowlist) prevents this exact silent-drop from recurring whenever
-- a new notification type is introduced.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
