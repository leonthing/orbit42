-- 1.10.0 글·사진 기본기 (PO 11/14 승인): 사진 설명, 고친 시각, 링크 페이지 고정 글. 추가만.

-- 사진 설명(선택, 200자)
alter table public.post_photos
  add column if not exists caption text;
alter table public.post_photos drop constraint if exists post_photos_caption_len;
alter table public.post_photos
  add constraint post_photos_caption_len check (caption is null or char_length(caption) <= 200);

-- "수정됨": 처음 공개하고 10분이 지난 뒤 제목·본문·사진·캡션을 바꿀 때만 서버가 찍는다
-- (updated_at 은 순서 바꾸기·자동 저장에도 바뀌어 기준으로 못 쓴다)
alter table public.blog_posts
  add column if not exists edited_at timestamptz;

-- 링크 페이지 맨 위 고정 글 1개. 글을 지우면 자동으로 풀린다. 본인 글인지는 서버(posts.ts)가 확인.
alter table public.users
  add column if not exists pinned_post_id uuid references public.blog_posts(id) on delete set null;

-- 권한: 세 표 모두 서버(service_role)만 쓴다. post_photos·blog_posts 는 v1100_post_photos 에서 이미 회수.
-- users 는 RLS(정책 없음)로 행이 막혀 있고, 새 칸도 브라우저 권한을 거둔다.
revoke all on public.post_photos from anon, authenticated;
revoke all on public.blog_posts from anon, authenticated;
revoke select (pinned_post_id), update (pinned_post_id), insert (pinned_post_id) on public.users from anon, authenticated;
grant select, insert, update, delete on public.post_photos to service_role;
grant select, insert, update, delete on public.blog_posts to service_role;
