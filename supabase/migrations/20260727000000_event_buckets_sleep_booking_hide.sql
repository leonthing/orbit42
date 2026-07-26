-- M10: 시간 자산 디벨롭 + 예약 목록 정리
-- 1) 이벤트 단위 버킷 재분류 (로컬/구글 이벤트 공용 — event_key 는
--    events.id 또는 "gcal_..." 문자열)
CREATE TABLE IF NOT EXISTS event_bucket_overrides (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_key)
);
ALTER TABLE event_bucket_overrides ENABLE ROW LEVEL SECURITY;

-- 2) 수면 시간 설정 (시간/일, null 이면 기본 7시간)
ALTER TABLE users ADD COLUMN IF NOT EXISTS sleep_hours numeric;

-- 3) 예약 소프트 삭제 — 각자 자기 목록에서만 숨김 (상대 기록·거래 통계 유지)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hidden_by_host boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hidden_by_guest boolean NOT NULL DEFAULT false;
