-- 개선-40 방향 결정(CEO·PO 10/25, b안): 계정 없는 게스트는 관리 링크에서 '제안' 대신 같은 예약의 시간을 바로 옮긴다.
-- 그래서 20261025200000 에서 추가했던 reschedule_by_guest 는 쓰이지 않는다 — 같은 날 만든 칸이고,
-- 지우기 전 확인: 값이 true 인 행 0 / 전체 18, 코드 참조 0. bookings_reschedule_complete 제약은 바꾸지 않았다.
alter table public.bookings drop column if exists reschedule_by_guest;
