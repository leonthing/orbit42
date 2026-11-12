-- 1.9.0 빈 표·칸 먼저 적용 (Leo 11/12 "전부 추천대로"). 추가만 — 지우는 것 없음, 쓰는 코드 없음.
-- 처리방침 개정: 안내 11/13, 시행 11/20. 시행일 전에는 이 칸·표를 쓰는 기능을 운영에 켜지 않는다.
-- 설계: 업무기록/설계_1.9.0_1대1대화.md 1절, 업무기록/설계_1.9.0_후속할일.md 1절.

-- ── 1:1 대화: 기존 conversations·messages 넓히기 ──
alter table public.conversations
  add column if not exists status text not null default 'open',
  add column if not exists requested_by uuid references public.users(id) on delete set null,
  add column if not exists requested_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists a_left_at timestamptz,
  add column if not exists b_left_at timestamptz,
  add column if not exists a_emailed_at timestamptz,
  add column if not exists b_emailed_at timestamptz,
  add column if not exists a_email_day date,
  add column if not exists b_email_day date,
  add column if not exists a_email_count int not null default 0,
  add column if not exists b_email_count int not null default 0,
  add column if not exists a_pushed_at timestamptz,
  add column if not exists b_pushed_at timestamptz;

alter table public.conversations drop constraint if exists conversations_status_check;
alter table public.conversations
  add constraint conversations_status_check check (status in ('open', 'requested', 'declined'));

create index if not exists conversations_requested_by_idx
  on public.conversations(requested_by, requested_at)
  where requested_by is not null;

-- 운영 메시지 0건(11/10·적용 직전 확인)이라 바로 검사
alter table public.messages drop constraint if exists messages_body_length_check;
alter table public.messages
  add constraint messages_body_length_check check (char_length(body) between 1 and 2000);

-- 신고: 1:1 대화 메시지도 같은 표로
alter table public.message_reports
  add column if not exists conversation_id uuid,
  add column if not exists dm_message_id uuid references public.messages(id) on delete set null;
alter table public.message_reports drop constraint if exists message_reports_reporter_role_check;
alter table public.message_reports
  add constraint message_reports_reporter_role_check check (reporter_role in ('host', 'guest', 'member'));

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;
grant select, insert, update, delete on public.conversations to service_role;
grant select, insert, update, delete on public.messages to service_role;
grant select, insert, update, delete on public.message_reports to service_role;

-- ── 할 일 ──
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_date date,
  done_at timestamptz,
  source_event_key text,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists todos_user_done_due_idx on public.todos(user_id, done_at, due_date);
create index if not exists todos_user_source_idx
  on public.todos(user_id, source_event_key)
  where source_event_key is not null;

-- ── 후속 일정 연결 ──
create table if not exists public.event_follow_ups (
  user_id uuid not null references public.users(id) on delete cascade,
  source_key text not null,
  target_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_key, target_key)
);

create index if not exists event_follow_ups_target_idx on public.event_follow_ups(user_id, target_key);

alter table public.todos enable row level security;
alter table public.event_follow_ups enable row level security;
grant select, insert, update, delete on public.todos to service_role;
grant select, insert, update, delete on public.event_follow_ups to service_role;
