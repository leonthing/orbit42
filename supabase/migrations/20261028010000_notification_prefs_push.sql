-- 알림 설정에 앱 푸시 칸 추가 (1.8.0 예약 대화 푸시). 추가만 — 기존 행은 모두 켜짐(default true)이라 동작 변화 없음.
-- 표는 이미 RLS 켜짐·서버(service_role)만 접근. 새 표가 아니라 GRANT 추가는 필요 없다.
alter table public.notification_prefs add column if not exists push boolean not null default true;
