-- 게스트 시간 변경 제안 횟수·메일 간격 (개선-29 손질).
-- 같은 예약에서 게스트가 제안을 여러 번 덮어쓸 때 호스트 메일이 폭주하지 않게
-- 메일은 10분에 1통, 제안은 하루(한국 시간) 5회까지. 알림 설정과 무관하게 세려고 예약 행에 둔다.
alter table public.bookings
  add column if not exists guest_proposal_day date,
  add column if not exists guest_proposal_count integer not null default 0,
  add column if not exists guest_proposal_mailed_at timestamptz;
