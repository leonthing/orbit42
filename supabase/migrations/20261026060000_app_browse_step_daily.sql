-- 앱 '가입 없이 둘러보기' 안에서 어디까지 가는지 (1.8.0, PO 전결) — 새 표 추가만, 기존 app_browse_daily(start/signup)는 그대로.
-- 날짜·단계별 '횟수'만 센다. 사람을 알아볼 값(IP·기기·user_id)은 저장하지 않는다. 한 둘러보기 안에서 탭 첫 진입은 한 번만 센다(앱이 거름).
-- 단계: 탭 첫 진입(tab_*) / 가입 시트를 연 동작(prompt_event 일정 저장·끌기, prompt_link 예약 링크, prompt_booking 예약하기, prompt_other 그 밖)
--      / 시트에서 고른 것(sheet_signup·sheet_login·sheet_close) / 위쪽 띠의 가입하기(banner_signup).
-- 쓰기·읽기는 서버(service_role)만 — anon/authenticated 접근 없음.
create table if not exists public.app_browse_step_daily (
  day date not null,
  step text not null check (step in (
    'tab_calendar', 'tab_bookings', 'tab_orbit', 'tab_asset', 'tab_profile',
    'prompt_event', 'prompt_link', 'prompt_booking', 'prompt_other',
    'sheet_signup', 'sheet_login', 'sheet_close', 'banner_signup'
  )),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, step)
);

alter table public.app_browse_step_daily enable row level security;
revoke all on public.app_browse_step_daily from anon, authenticated;
grant select, insert, update, delete on public.app_browse_step_daily to service_role;

create or replace function public.bump_app_browse_step(p_day date, p_step text) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.app_browse_step_daily (day, step, count)
  values (p_day, p_step, 1)
  on conflict (day, step) do update set count = public.app_browse_step_daily.count + 1, updated_at = now();
$$;
revoke all on function public.bump_app_browse_step(date, text) from public, anon, authenticated;
grant execute on function public.bump_app_browse_step(date, text) to service_role;
