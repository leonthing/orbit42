-- 일정 주석(1.5.0 A): 사용자별·일정별 중요도와 완료 후 별점. 본인만 본다.
-- event_key 는 기존 event_completions·event_bucket_overrides 와 같은 키 —
-- Orbit42 일정은 events.id, 구글 일정은 "gcal_<구글 id>". 구글에는 아무것도 쓰지 않고,
-- 구글 일정의 제목·시각도 여기 남기지 않는다(개인정보 처리방침: 구글 일정은 복사해 두지 않음).
create table if not exists public.event_annotations (
  user_id uuid not null references public.users(id) on delete cascade,
  event_key text not null,
  -- -1 가벼움 / 0 보통(기본) / 1 중요함
  importance smallint not null default 0 check (importance in (-1, 0, 1)),
  rating smallint check (rating between 1 and 5),
  rating_note text check (char_length(rating_note) <= 500),
  rated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_key)
);
create index if not exists event_annotations_rated_idx
  on public.event_annotations (user_id, rated_at) where rating is not null;
-- 앱·웹은 서버(service role)로만 읽고 쓴다. 클라이언트 키로는 아무 행도 못 보게 RLS 만 켜고 정책은 두지 않는다
-- (이 앱은 Supabase Auth 를 쓰지 않아 auth.uid() 정책을 걸 수 없다 — 본인 제한은 API 가 세션의 user_id 로 건다).
alter table public.event_annotations enable row level security;
