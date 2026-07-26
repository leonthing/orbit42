-- 캘린더 용도에 '투자'(invest) 추가 — 자산 탭 기본 매핑은 투자 버킷.
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
      'health', 'social', 'learning', 'invest'
    )
  );
