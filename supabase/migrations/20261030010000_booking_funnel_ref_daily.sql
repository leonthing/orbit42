-- 방문 출처 범주별 익명 집계 (1.8.0, PO 전결) — 새 표 추가만, 기존 집계 표는 그대로.
-- 날짜·호스트·단계·출처 범주별 '횟수'만 센다. 리퍼러 주소·도메인 원문·IP·UA·user_id 는 저장하지 않는다.
-- 범주는 브라우저가 정해서 이름만 보낸다(instagram·kakao·threads·x·youtube·search·orbit42·direct·other).
-- 웹 방문만(앱은 출처가 없음). 쓰기·읽기는 서버(service_role)만 — 10/30 규칙대로 같은 파일에 RLS + GRANT.
create table if not exists public.booking_funnel_ref_daily (
  day date not null,
  host_id uuid not null references public.users(id) on delete cascade,
  step text not null check (step in ('profile_view', 'slot_view', 'time_picked', 'booked')),
  ref text not null check (ref in ('instagram', 'kakao', 'threads', 'x', 'youtube', 'search', 'orbit42', 'direct', 'other')),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, host_id, step, ref)
);
create index if not exists booking_funnel_ref_daily_day on public.booking_funnel_ref_daily (day);

alter table public.booking_funnel_ref_daily enable row level security;
revoke all on public.booking_funnel_ref_daily from anon, authenticated;
grant select, insert, update, delete on public.booking_funnel_ref_daily to service_role;

create or replace function public.bump_booking_funnel_ref(
  p_day date, p_host uuid, p_step text, p_ref text
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.booking_funnel_ref_daily (day, host_id, step, ref, count)
  values (p_day, p_host, p_step, p_ref, 1)
  on conflict (day, host_id, step, ref)
  do update set count = public.booking_funnel_ref_daily.count + 1, updated_at = now();
$$;
revoke all on function public.bump_booking_funnel_ref(date, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bump_booking_funnel_ref(date, uuid, text, text) to service_role;
