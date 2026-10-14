-- 다시 알림(1.5.0 B) — 이 시각에 기기 알림으로 일정을 다시 보여 준다. 지났으면 끝난 것(목록에서 빠짐). null = 없음.
alter table public.event_annotations add column if not exists remind_at timestamptz;
create index if not exists event_annotations_remind_idx
  on public.event_annotations (user_id, remind_at) where remind_at is not null;
