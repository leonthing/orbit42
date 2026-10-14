-- 일정별 알림 시점(1.5.0 A 2차, 기기 로컬 알림). null = 설정의 기본값, -1 = 알림 없음, 0 = 정각, 분 단위 = 그만큼 전.
alter table public.event_annotations
  add column if not exists reminder_minutes smallint check (reminder_minutes between -1 and 1440);
