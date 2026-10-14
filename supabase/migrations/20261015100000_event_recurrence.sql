-- 반복 일정(1.5.1). 모두 추가만 — 지금 일정은 rrule null(한 번짜리)이라 동작 변화 없음.
-- rrule: RFC 5545 RRULE(구글과 같은 문자열). recurrence_until: 마지막 회차 시작(null = 끝없음, 기간 조회 거르기용).
alter table public.events add column if not exists rrule text;
alter table public.events add column if not exists recurrence_until timestamptz;
alter table public.events add column if not exists is_anniversary boolean not null default false;
create index if not exists events_recurring_idx on public.events (user_id) where rrule is not null;

-- 회차 예외('이 일정만' 수정·삭제). 바꾼 값만 채우고 null = 시리즈 그대로.
create table if not exists public.event_recurrence_exceptions (
  event_id uuid not null references public.events(id) on delete cascade,
  original_start timestamptz not null,
  cancelled boolean not null default false,
  start_at timestamptz,
  end_at timestamptz,
  title text,
  description text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, original_start)
);
alter table public.event_recurrence_exceptions enable row level security;
