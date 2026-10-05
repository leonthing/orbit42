-- 계좌이체 결제 흐름 (PG 없이).
--
-- 1:1 세션을 파는 사람들은 지금도 "예약 → 계좌 안내 → 입금 확인 → 확정"을
-- 카톡으로 손수 한다. 그 흐름을 그대로 앱 안으로 옮긴다:
--   호스트가 결제 안내(계좌·송금 링크)를 적어 두면, 유료 슬롯 예약은
--   '입금 대기'(pending + payment_status=awaiting)로 들어가고, 게스트는 완료
--   화면·메일에서 안내를 받는다. 호스트가 입금을 확인하면 확정(paid)되고,
--   기한(payment_due_at)까지 확인되지 않으면 자동으로 취소된다.

alter table public.users
  add column if not exists payment_instructions text;

alter table public.bookings
  add column if not exists payment_status text,
  add column if not exists payment_due_at timestamptz;

alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status is null or payment_status in ('awaiting', 'paid'));

-- 만료 cron 이 훑는 대상만 작게 색인
create index if not exists bookings_payment_awaiting_idx
  on public.bookings (payment_due_at)
  where payment_status = 'awaiting' and status = 'pending';
