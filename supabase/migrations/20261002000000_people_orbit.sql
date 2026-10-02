-- 관계 궤도(사람).
--
-- 쓰이지 않던 contacts 테이블을 "내가 만나는 사람" 목록으로 되살린다.
-- 한 사람 = contacts 한 행. orbit42 회원이면 linked_user_id 로 이어진다.
--
-- 사람은 여러 경로로 들어온다:
--   follow      — 내가 팔로우한 회원 (관계의 기본 신호)
--   booking     — 예약으로 만난 사람 (회원이든 이메일만 남긴 게스트든)
--   participant — 일정 참석자로 초대한 사람
--   google      — 구글 캘린더 일정의 참석자 (사용자가 켰을 때만)
--   device      — iOS 기기 캘린더(iCloud·Exchange 등) 참석자 (사용자가 켰을 때만)
--   manual      — 직접 추가
--
-- 캘린더에서 자동으로 찾은 사람은 바로 궤도에 넣지 않고 'suggested' 로 둔다.
-- 사용자가 고르면 'active', 거절하면 'dismissed'(다시 제안하지 않는다).

alter table public.contacts
  add column if not exists status text not null default 'active',
  add column if not exists source text not null default 'manual',
  add column if not exists archived_at timestamptz,
  -- 안부 넛지를 닫은 시각. 그 뒤에 다시 만나기 전까지는 같은 넛지를 띄우지 않는다.
  add column if not exists nudge_dismissed_at timestamptz;

alter table public.contacts drop constraint if exists contacts_status_check;
alter table public.contacts
  add constraint contacts_status_check
  check (status in ('suggested', 'active', 'archived', 'dismissed'));

alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts
  add constraint contacts_source_check
  check (source in ('manual', 'follow', 'booking', 'participant', 'google', 'device'));

-- 같은 사람이 두 번 생기지 않게: 이메일, 그리고 연결된 회원 기준으로 하나씩.
create unique index if not exists contacts_user_email_uniq
  on public.contacts (user_id, lower(email))
  where email is not null;
create unique index if not exists contacts_user_linked_uniq
  on public.contacts (user_id, linked_user_id)
  where linked_user_id is not null;

-- 만남 기록. 궤도의 거리(마지막 만남)·함께한 시간·횟수가 여기서 나온다.
-- 같은 사람과 같은 시각에 시작한 만남은 하나로 본다 — 구글과 기기 캘린더에
-- 같은 회의가 함께 잡혀 있어도 두 번 세지 않는다.
create table if not exists public.contact_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  source text not null
    check (source in ('manual', 'booking', 'participant', 'google', 'device')),
  -- 원본 식별자 (booking id, event_key, gcal id, 기기 이벤트 id). 재동기화 시 정리에 쓴다.
  source_ref text,
  title text,
  start_at timestamptz not null,
  end_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists contact_meetings_contact_start_uniq
  on public.contact_meetings (contact_id, start_at);
create index if not exists contact_meetings_user_start_idx
  on public.contact_meetings (user_id, start_at desc);

alter table public.contact_meetings enable row level security;

-- 캘린더에서 사람 가져오기: 기본은 꺼짐. 켜야만 참석자를 읽어 저장한다.
alter table public.users
  add column if not exists people_import_enabled boolean not null default false,
  add column if not exists people_synced_at timestamptz;
