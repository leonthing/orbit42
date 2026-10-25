-- 배포 없이 켜고 끄는 운영 스위치 (1.6.0 출시 대비). 서버(service role)만 읽고 쓴다.
-- 예: reminders_paused = true 면 예약 리마인더 cron 이 아무것도 보내지 않는다.
create table if not exists public.app_flags (
  key text primary key,
  enabled boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.app_flags enable row level security;
-- 정책 없음: anon·authenticated 는 읽기·쓰기 불가. service_role 만.
revoke all on public.app_flags from anon, authenticated;
grant select, insert, update, delete on public.app_flags to service_role;

insert into public.app_flags (key, enabled, note)
values ('reminders_paused', false, '예약 리마인더(하루 전·1시간 전) 발송 멈춤')
on conflict (key) do nothing;
