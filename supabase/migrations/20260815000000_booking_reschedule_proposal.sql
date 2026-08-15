-- 예약 시간 변경 제안.
--
-- 게스트 방향은 이미 rescheduleMyBooking 이 처리한다 — 호스트가 열어둔 가용
-- 시간 안에서만 고르므로 별도 합의가 필요 없고, 승인이 필요한 슬롯이면
-- status 가 pending 으로 돌아가는 것이 곧 재승인 절차다.
--
-- 반대로 호스트가 시간을 옮기는 건 게스트가 그 시간에 갈 수 있는지 알 수
-- 없으므로 반드시 상대 수락이 필요하다. 그래서 "대기 중인 제안" 한 건을
-- 예약 행에 얹어두고, 수락되면 그때 scheduled_at 을 실제로 옮긴다.
--
-- 제안은 예약당 항상 최대 1건이다 (새 제안이 이전 것을 덮어쓴다). 왕복이
-- 무한히 늘어나는 걸 막고, 어느 시간이 협상 대상인지 모호해지지 않게 한다.

alter table public.bookings
  -- 제안한 사람. 지금은 호스트만 제안하지만, 방향을 컬럼으로 남겨두면
  -- 나중에 게스트 쪽 제안형이 필요해져도 스키마를 다시 안 건드린다.
  add column if not exists reschedule_by uuid references public.users(id) on delete set null,
  add column if not exists reschedule_start_at timestamptz,
  add column if not exists reschedule_end_at timestamptz,
  -- 변경 사유 한 줄 — 대부분의 "따로 연락"이 이걸로 대체된다.
  add column if not exists reschedule_note text,
  add column if not exists reschedule_created_at timestamptz;

-- 제안은 네 컬럼이 함께 차거나 함께 비어야 한다. 한쪽만 남은 상태로
-- 배너가 뜨거나, 시작 시각 없이 수락 가능한 제안이 생기는 걸 막는다.
alter table public.bookings
  drop constraint if exists bookings_reschedule_complete;
alter table public.bookings
  add constraint bookings_reschedule_complete check (
    (
      reschedule_by is null
      and reschedule_start_at is null
      and reschedule_end_at is null
      and reschedule_created_at is null
    )
    or (
      reschedule_by is not null
      and reschedule_start_at is not null
      and reschedule_end_at is not null
      and reschedule_created_at is not null
    )
  );

-- 대기 중인 제안 조회용 (예약 목록에서 배너 띄울 때).
create index if not exists bookings_reschedule_pending_idx
  on public.bookings (guest_id, reschedule_created_at)
  where reschedule_created_at is not null;
