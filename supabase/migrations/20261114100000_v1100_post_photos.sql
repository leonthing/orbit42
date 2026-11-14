-- 1.10.0 글·사진 (iOS 먼저, 내부 계정 시험 — PO 11/14, 설계_1.10.0_블로그사진.md 2-2)
-- 추가만 + 권한 좁히기. 운영 블로그 글은 내부 2개뿐(11/14 집계).

-- ── 글 ──
-- origin: 'web' = 기존 마크다운 블로그, 'app' = 앱에서 쓴 사진 글.
-- 시험 기간에는 웹 공개 경로(/blog-public·사이트맵·RSS·프로필)가 'web'만 보여 준다.
alter table public.blog_posts
  add column if not exists origin text not null default 'web',
  add column if not exists hidden_at timestamptz;  -- 운영자 숨김(신고 처리)
alter table public.blog_posts drop constraint if exists blog_posts_origin_check;
alter table public.blog_posts
  add constraint blog_posts_origin_check check (origin in ('web', 'app'));
create index if not exists blog_posts_user_origin_idx on public.blog_posts(user_id, origin, created_at desc);

-- ── 사진 ──
create table if not exists public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  storage_key text not null,          -- <userId>/<postId>/<photoId>.jpg (버킷 post-photos)
  width int not null check (width > 0),
  height int not null check (height > 0),
  bytes int not null check (bytes > 0),
  created_at timestamptz not null default now()
);
-- 순서 바꾸기를 한 번에 하려고 유일 제약은 지연 검사
alter table public.post_photos drop constraint if exists post_photos_post_position_key;
alter table public.post_photos
  add constraint post_photos_post_position_key unique (post_id, position) deferrable initially deferred;
create index if not exists post_photos_user_idx on public.post_photos(user_id, created_at desc);

alter table public.post_photos enable row level security;
revoke all on public.post_photos from anon, authenticated;
grant select, insert, update, delete on public.post_photos to service_role;

-- 블로그 표도 서버(service_role)만 — RLS 정책이 없어 지금도 0줄이지만 권한까지 거둔다
revoke all on public.blog_posts from anon, authenticated;
revoke all on public.blog_post_slugs from anon, authenticated;
grant select, insert, update, delete on public.blog_posts to service_role;
grant select, insert, update, delete on public.blog_post_slugs to service_role;

-- ── 신고: 글도 message_reports 로 (PO 11/14 결정 9) ──
alter table public.message_reports
  add column if not exists post_id uuid references public.blog_posts(id) on delete set null,
  add column if not exists kind text;
update public.message_reports
  set kind = case when conversation_id is not null then 'dm' else 'booking' end
  where kind is null;
alter table public.message_reports drop constraint if exists message_reports_kind_check;
alter table public.message_reports
  add constraint message_reports_kind_check check (kind is null or kind in ('booking', 'dm', 'post'));

-- ── 비공개 버킷: 서버가 서명 URL(1시간)로만 연다. storage.objects 정책 없음 ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 4194304, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 4194304, allowed_mime_types = array['image/jpeg'];

-- 사진 순서 바꾸기를 한 트랜잭션으로(유일 제약은 지연 검사라 중간에 겹쳐도 됨). 서버(service_role)만.
create or replace function public.reorder_post_photos(p_post uuid, p_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
declare
  i int;
begin
  if (select count(*) from public.post_photos where post_id = p_post) <> coalesce(array_length(p_ids, 1), 0) then
    raise exception 'photo set mismatch';
  end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update public.post_photos set position = i - 1 where id = p_ids[i] and post_id = p_post;
    if not found then
      raise exception 'photo not in post';
    end if;
  end loop;
end;
$$;
revoke all on function public.reorder_post_photos(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_post_photos(uuid, uuid[]) to service_role;
