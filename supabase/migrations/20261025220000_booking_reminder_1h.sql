-- ③ 다시 부르는 알림: 예약 1시간 전 리마인더를 보낸 시각 (24시간 전은 reminder_sent_at).
-- 칸 추가만 — 기존 칸·제약은 그대로.
alter table public.bookings
  add column if not exists reminder_1h_sent_at timestamptz;

create index if not exists idx_bookings_reminder_1h_due
  on public.bookings (scheduled_at)
  where reminder_1h_sent_at is null and status = 'confirmed';
