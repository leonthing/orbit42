-- 프로필 비공개: 검색·프로필 조회·오르빗 노출에서 숨긴다.
-- (직접 공유한 예약 링크는 본인 의사이므로 계속 동작)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
