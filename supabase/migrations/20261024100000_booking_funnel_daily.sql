-- 예약 링크 방문 흐름 익명 집계 (개선-32).
-- 날짜·호스트·예약 링크·단계·출처별 '횟수'만 센다. 사람을 알아볼 수 있는 값(IP·쿠키·user_id·UA)은 저장하지 않고,
-- 같은 사람 중복도 따지지 않는다. 쓰기·읽기는 서버(service_role)만 — anon/authenticated 는 접근 없음.
create table if not exists public.booking_funnel_daily (
  day date not null,
  host_id uuid not null references public.users(id) on delete cascade,
  -- 프로필(링크 페이지) 열람은 특정 예약 링크가 없어 null
  slot_id uuid references public.time_slots(id) on delete cascade,
  step text not null check (step in ('profile_view', 'slot_view', 'time_picked', 'booked')),
  source text not null check (source in ('web', 'ios')),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);

-- slot_id 가 null 인 행도 한 줄로 모이게 키를 만든다
create unique index if not exists booking_funnel_daily_key
  on public.booking_funnel_daily (day, host_id, coalesce(slot_id, '00000000-0000-0000-0000-000000000000'::uuid), step, source);
create index if not exists booking_funnel_daily_day on public.booking_funnel_daily (day);

alter table public.booking_funnel_daily enable row level security;
revoke all on public.booking_funnel_daily from anon, authenticated;
grant select, insert, update, delete on public.booking_funnel_daily to service_role;

-- 한 번에 +1 (동시에 와도 잃지 않게 upsert)
create or replace function public.bump_booking_funnel(
  p_day date, p_host uuid, p_slot uuid, p_step text, p_source text
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.booking_funnel_daily (day, host_id, slot_id, step, source, count)
  values (p_day, p_host, p_slot, p_step, p_source, 1)
  on conflict (day, host_id, coalesce(slot_id, '00000000-0000-0000-0000-000000000000'::uuid), step, source)
  do update set count = public.booking_funnel_daily.count + 1, updated_at = now();
$$;
revoke all on function public.bump_booking_funnel(date, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bump_booking_funnel(date, uuid, uuid, text, text) to service_role;
