-- 개선-25 지난 예약 보관 — 호스트·게스트가 각자 자기 목록에서 보관(되돌릴 수 있음).
-- 삭제(hidden_by_*)와 별개. 추가만 하는 변경이라 기존 앱·웹 목록은 그대로다.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived_by_host boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived_by_guest boolean NOT NULL DEFAULT false;
