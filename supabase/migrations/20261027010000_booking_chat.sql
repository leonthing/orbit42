-- 예약 대화 + 앱 푸시 (1.8.0, 설계: 업무기록/설계_1.8.0_예약대화.md)
-- 새 표 4개 추가만. 모두 서버(service_role)만 읽고 쓴다 — 브라우저 직접 접근 없음.
-- 10/30부터 새 표는 Data API 권한이 자동으로 붙지 않으므로 같은 파일에 RLS + GRANT(service_role)만 둔다.
-- anon·authenticated 에는 주지 않는다.

-- 예약 1건에 대화방 1개 (첫 글을 쓸 때 만든다)
create table if not exists public.booking_threads (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  last_message_at timestamptz,
  last_sender_role text check (last_sender_role in ('host', 'guest')),
  host_last_read_at timestamptz,
  guest_last_read_at timestamptz,
  -- 메일 묶음(같은 대화 10분 간격·하루 6통): 마지막 메일 시각과 그날 보낸 수
  host_emailed_at timestamptz,
  guest_emailed_at timestamptz,
  host_email_day date,
  host_email_count int not null default 0,
  guest_email_day date,
  guest_email_count int not null default 0,
  -- 앱 푸시 간격(같은 대화 60초)
  host_pushed_at timestamptz,
  guest_pushed_at timestamptz,
  closed_at timestamptz,
  closed_by text check (closed_by in ('host', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists booking_threads_last_message_idx
  on public.booking_threads(last_message_at desc);

-- 메시지 (글자만). 계정 없는 게스트가 쓴 글은 sender_id 가 null.
create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_threads(booking_id) on delete cascade,
  sender_role text not null check (sender_role in ('host', 'guest')),
  sender_id uuid references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists booking_messages_booking_idx
  on public.booking_messages(booking_id, created_at);

-- 앱 푸시 기기 토큰 (로그아웃·앱 삭제(APNs 410)·탈퇴 때 삭제)
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  env text not null default 'production' check (env in ('production', 'sandbox')),
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_devices_user_idx on public.push_devices(user_id);

-- 메시지 신고 (메시지가 지워져도 처리 기록은 남는다 — 처리방침: 신고 처리 기록으로 1년 보관)
create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  message_id uuid references public.booking_messages(id) on delete set null,
  reporter_role text not null check (reporter_role in ('host', 'guest')),
  reporter_id uuid references public.users(id) on delete set null,
  reason text,
  body_snapshot text,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

alter table public.booking_threads enable row level security;
alter table public.booking_messages enable row level security;
alter table public.push_devices enable row level security;
alter table public.message_reports enable row level security;

grant select, insert, update, delete on public.booking_threads to service_role;
grant select, insert, update, delete on public.booking_messages to service_role;
grant select, insert, update, delete on public.push_devices to service_role;
grant select, insert, update, delete on public.message_reports to service_role;
