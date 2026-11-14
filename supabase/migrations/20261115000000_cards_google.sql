-- 명함 → 구글 연락처 1차(Leo 전용, 11/15). 추가만 한다.
-- 명함용 구글 토큰은 캘린더 토큰(users.google_* / google_accounts)과 따로 둔다:
-- 명함 연결 해제(기본)는 이 행만 지우고 캘린더 연결은 그대로 둔다.
-- 명함 원본(사진·글자)은 여기에도, 다른 표에도 남기지 않는다(사진은 Leo Drive로 바로 보냄).
create table if not exists public.card_google_tokens (
  user_id uuid primary key references public.users(id) on delete cascade,
  email text,
  access_token text,
  refresh_token text not null,
  token_expiry timestamptz,
  scope text,
  drive_folder_id text,           -- 'Orbit42 명함' 폴더(drive.file: 앱이 만든 폴더만 접근)
  card_group_resource text,       -- 'Card' 연락처 그룹 resourceName
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.card_google_tokens enable row level security;
revoke all on public.card_google_tokens from anon, authenticated;
grant select, insert, update, delete on public.card_google_tokens to service_role;
