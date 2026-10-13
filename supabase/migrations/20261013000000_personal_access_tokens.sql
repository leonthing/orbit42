-- 개인 액세스 토큰 (CEO 세션 등 외부 도구 연동). 토큰 값은 저장하지 않는다 —
-- 서명된 토큰에 이 행의 id 가 들어 있고, 요청마다 폐기 여부를 여기서 확인한다.
-- 권한은 코드(lib/pat-scope)의 허용 목록으로 제한: 일정·예약 읽기 + 완료 체크.
create table if not exists public.personal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists personal_access_tokens_user_idx on public.personal_access_tokens (user_id);
alter table public.personal_access_tokens enable row level security;
