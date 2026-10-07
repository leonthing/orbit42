-- 예약 링크에서 호스트가 "이 시간 예약 안 받기"로 닫은 시각.
-- 게스트에게는 숨기고, 호스트 화면에선 '예약 안 받음'으로 보여 다시 열 수 있게 한다.
-- 수동 시간 창(slot_availabilities)이나 자동 계산 시간 모두 시작 시각으로 맞춘다.
create table if not exists public.slot_closed_times (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.time_slots(id) on delete cascade,
  start_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (slot_id, start_at)
);
create index if not exists slot_closed_times_slot_idx on public.slot_closed_times (slot_id, start_at);
alter table public.slot_closed_times enable row level security;
