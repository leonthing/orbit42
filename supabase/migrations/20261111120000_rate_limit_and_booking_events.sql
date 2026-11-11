-- 보안-8: 여러 서버에서 함께 세는 횟수 제한, 예약 상태 변경 기록.
-- 둘 다 서버(service_role)만 쓴다 — anon/authenticated 권한 없음, RLS 켬(정책 없음 = 막힘).

create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,            -- 'login' · 'signup' · 'social-gen' …
  subject text not null,           -- 아이디·IP·이메일을 서버 비밀 소금과 HMAC 한 값(원문 저장 안 함)
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup on public.rate_limit_hits (bucket, subject, created_at desc);
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;
grant select, insert, delete on public.rate_limit_hits to service_role;
grant usage, select on sequence public.rate_limit_hits_id_seq to service_role;

create table if not exists public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  -- 처리방침의 예약 정보 범위 안: 상태·시각·주체 종류만. 이메일·이름·사용자 id 는 넣지 않는다.
  -- 보관: 예약이 끝난 날로부터 1년(예약 대화와 같음) — /api/cron/cleanup
  actor_kind text not null check (actor_kind in ('host', 'guest', 'guest_link', 'system')),
  action text not null check (action in ('status', 'reschedule')),
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);
create index if not exists booking_events_booking on public.booking_events (booking_id, created_at desc);
alter table public.booking_events enable row level security;
revoke all on public.booking_events from anon, authenticated;
grant select, insert, delete on public.booking_events to service_role;
grant usage, select on sequence public.booking_events_id_seq to service_role;
