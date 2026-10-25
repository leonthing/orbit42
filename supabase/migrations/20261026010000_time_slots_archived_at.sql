-- 예약 링크 보관 (개선-45, CEO 10/26) — 칸 추가만.
-- archived_at: 예약 기록이 있어 지울 수 없는 링크를 '보관'한 시각. 보관하면 active=false 로 공개 페이지·새 예약이 막히고,
-- 호스트 목록·링크 직접 접속에서도 빠진다. 기존 예약(관리 링크·리마인더·받은 예약 목록)은 그대로 둔다.
-- 권한: time_slots 기존 표 단위 GRANT·RLS 를 그대로 따른다(칸 단위 GRANT 없음). 쓰는 곳은 서버(service role)뿐.
alter table public.time_slots add column if not exists archived_at timestamptz;
