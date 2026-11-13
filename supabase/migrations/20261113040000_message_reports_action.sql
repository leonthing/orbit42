-- 1.9.0: 운영자 신고 처리(차단·숨김·무시) 기록 — /admin/reports (PO 11/13, 가이드라인 1.2)
alter table public.message_reports
  add column if not exists action text,
  add column if not exists handled_by text;
alter table public.message_reports drop constraint if exists message_reports_action_check;
alter table public.message_reports
  add constraint message_reports_action_check check (action is null or action in ('block', 'hide', 'ignore'));
create index if not exists message_reports_open_idx on public.message_reports(created_at desc) where handled_at is null;
