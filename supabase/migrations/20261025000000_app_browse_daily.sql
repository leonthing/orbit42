-- 앱 '가입 없이 둘러보기' 익명 집계 (개선-47).
-- 날짜·단계별 '횟수'만 센다(둘러보기 시작 / 둘러보기에서 가입). 사람을 알아볼 값(IP·기기·user_id)은 저장하지 않는다.
-- 쓰기·읽기는 서버(service_role)만 — anon/authenticated 는 접근 없음.
create table if not exists public.app_browse_daily (
  day date not null,
  step text not null check (step in ('start', 'signup')),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, step)
);

alter table public.app_browse_daily enable row level security;
revoke all on public.app_browse_daily from anon, authenticated;
grant select, insert, update, delete on public.app_browse_daily to service_role;

create or replace function public.bump_app_browse(p_day date, p_step text) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.app_browse_daily (day, step, count)
  values (p_day, p_step, 1)
  on conflict (day, step) do update set count = public.app_browse_daily.count + 1, updated_at = now();
$$;
revoke all on function public.bump_app_browse(date, text) from public, anon, authenticated;
grant execute on function public.bump_app_browse(date, text) to service_role;
