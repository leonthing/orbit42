-- Time insights: per-user default working hours + extended calendar purposes
-- so events can be bucketed into meaningful categories (업무/개인/건강/사교/학습 등).

-- 1. Add work_hours jsonb to users. Shape: { "mon": {"start":"09:00","end":"18:00"}, ... }
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS work_hours jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Extend the calendars.purpose CHECK to add health/social/learning.
-- Drop the existing constraint (auto-generated name pattern) and re-add it.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'calendars'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%purpose%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE calendars DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE calendars
  ADD CONSTRAINT calendars_purpose_check CHECK (
    purpose IS NULL OR purpose IN (
      'personal', 'work', 'couple', 'income', 'hobby', 'other',
      'health', 'social', 'learning'
    )
  );

-- Mirror the change on user_calendar_settings (legacy table, still populated).
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'user_calendar_settings'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%purpose%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE user_calendar_settings DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE user_calendar_settings
  ADD CONSTRAINT user_calendar_settings_purpose_check CHECK (
    purpose IS NULL OR purpose IN (
      'personal', 'work', 'couple', 'income', 'hobby', 'other',
      'health', 'social', 'learning'
    )
  );
