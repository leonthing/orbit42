-- 예약 링크 방문 출처별 익명 집계 (1.7.0 공유 카드, PO 전결) — 새 표 추가만, 기존 booking_funnel_daily 는 그대로.
-- 공유 카드 링크(?via=card)로 들어온 방문의 단계별 '횟수'만 센다. 사람을 알아볼 값(IP·UA·리퍼러·user_id)은 저장하지 않는다.
-- 출처는 정해 둔 값만(card). 쓰기·읽기는 서버(service_role)만 — anon/authenticated 접근 없음.
create table if not exists public.booking_funnel_via_daily (
  day date not null,
  host_id uuid not null references public.users(id) on delete cascade,
  slot_id uuid not null references public.time_slots(id) on delete cascade,
  step text not null check (step in ('slot_view', 'time_picked', 'booked')),
  via text not null check (via in ('card')),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, host_id, slot_id, step, via)
);
create index if not exists booking_funnel_via_daily_day on public.booking_funnel_via_daily (day);

alter table public.booking_funnel_via_daily enable row level security;
revoke all on public.booking_funnel_via_daily from anon, authenticated;
grant select, insert, update, delete on public.booking_funnel_via_daily to service_role;

create or replace function public.bump_booking_funnel_via(
  p_day date, p_host uuid, p_slot uuid, p_step text, p_via text
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.booking_funnel_via_daily (day, host_id, slot_id, step, via, count)
  values (p_day, p_host, p_slot, p_step, p_via, 1)
  on conflict (day, host_id, slot_id, step, via)
  do update set count = public.booking_funnel_via_daily.count + 1, updated_at = now();
$$;
revoke all on function public.bump_booking_funnel_via(date, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bump_booking_funnel_via(date, uuid, uuid, text, text) to service_role;
