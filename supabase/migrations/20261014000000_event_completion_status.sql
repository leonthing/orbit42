-- 일정 상태: 완료(done) 외에 보관(archived). 원본 일정은 그대로 두고 표시만 바꾼다.
-- 기존 행은 모두 완료(done). 한 일정에 상태는 하나 (완료 ↔ 보관 은 서로 바꿔 쓴다).
alter table public.event_completions
  add column if not exists status text not null default 'done'
  check (status in ('done', 'archived'));
