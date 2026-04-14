ALTER TABLE user_calendar_settings
  ADD COLUMN IF NOT EXISTS purpose text CHECK (
    purpose IS NULL OR purpose IN (
      'personal', 'work', 'couple', 'income', 'hobby', 'other'
    )
  ),
  ADD COLUMN IF NOT EXISTS color_override text;
