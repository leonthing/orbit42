-- A1: 프리랜서(불규칙 수입) 모드 — 월별 수입 기록으로 실효 시급을 계산한다.
CREATE TABLE IF NOT EXISTS income_entries (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  amount bigint NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

-- A2: 캘린더별 시간당 단가(원) — 수입 버킷 금액을 실제 매출 추정으로.
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS hourly_rate_krw integer;
