-- 이메일은 LIKE 없이 정확 일치로만 찾는다(PO 11/16, 11/15 ilike 와일드카드 보안 수정의 후속).
-- users 에는 이미 lower(email) 유일 인덱스 idx_users_email_unique 가 있다 → 아래 함수가 그 인덱스를 탄다.
-- 추가만 하는 마이그레이션: 기존 표·열·값은 바꾸지 않는다.

-- ── 이메일로 회원 id 찾기(대소문자·앞뒤 공백 무시, 정확 일치) ──
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.users
  where email is not null and lower(email) = lower(btrim(p_email))
  limit 1
$$;

-- ── 게스트 이메일로 최근 예약 수(예약 남용 제한용, 정확 일치) ──
create or replace function public.guest_bookings_since(p_email text, p_since timestamptz)
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*) from public.bookings
  where guest_email is not null and lower(guest_email) = lower(btrim(p_email)) and created_at >= p_since
$$;

revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
revoke all on function public.guest_bookings_since(text, timestamptz) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
grant execute on function public.guest_bookings_since(text, timestamptz) to service_role;

-- ── 소셜 로그인으로 기존 계정에 들어간 기록(보안 감사, 90일) ──
-- 이메일 원문은 남기지 않는다: email_hash = HMAC-SHA256(서버 키, 소문자 이메일). 서버(service_role)만.
create table if not exists public.oauth_login_audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  provider text not null check (provider in ('google', 'apple')),
  matched_by text not null check (matched_by in ('email', 'apple_sub')),
  user_id uuid not null references public.users(id) on delete cascade,
  email_hash text
);
create index if not exists oauth_login_audit_created_at on public.oauth_login_audit (created_at);
create index if not exists oauth_login_audit_user on public.oauth_login_audit (user_id, created_at desc);

alter table public.oauth_login_audit enable row level security;
revoke all on public.oauth_login_audit from public, anon, authenticated;
grant select, insert, delete on public.oauth_login_audit to service_role;
