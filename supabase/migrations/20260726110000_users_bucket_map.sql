-- 시간 자산 버킷 커스터마이즈: 캘린더 용도(purpose) → 수입/투자/소비/생활
-- 버킷 매핑의 사용자별 오버라이드. null 이면 기본 매핑 사용.
-- 형식: {"health": "life", "hobby": "invest", ...} (부분 오버라이드)
ALTER TABLE users ADD COLUMN IF NOT EXISTS bucket_map jsonb;
