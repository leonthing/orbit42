-- 게스트 리마인더 끄기 (1.7.0) — 칸 추가만.
-- guest_reminders_off_at: 게스트가 관리 링크(/b#토큰)에서 이 예약의 리마인더 메일(24시간·1시간 전)을 끈 시각. 비어 있으면 켜짐.
-- 게스트 메일만 건너뛴다(호스트 리마인더·앱 알림·확정/변경/취소 메일은 그대로). 다시 켜면 아직 안 지난 회차부터 보낸다.
-- 권한: bookings 기존 표 단위 GRANT·RLS 를 그대로 따른다(칸 단위 GRANT 없음). 읽고 쓰는 곳은 서버(service role)뿐.
alter table public.bookings add column if not exists guest_reminders_off_at timestamptz;
