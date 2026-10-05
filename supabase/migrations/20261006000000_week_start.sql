-- 웹 캘린더의 주 시작 요일 (월/일). iOS 는 기기 설정(AppSettings)을 따로 쓴다.
alter table public.users
  add column if not exists week_start text not null default 'mon';
alter table public.users drop constraint if exists users_week_start_check;
alter table public.users
  add constraint users_week_start_check check (week_start in ('mon', 'sun'));
