-- 공개 링크 페이지 직접 링크 (개선-46, PO 전결) — 칸 추가만.
-- custom_links: 호스트가 고른 링크 [{ "title": "...", "url": "https://..." }] 최대 5개, 순서대로 보인다.
-- 기존 social_links(정해진 SNS 키 → 주소)는 형식을 바꾸지 않고 그대로 둔다(제목·순서가 없어 따로 칸을 둠).
-- 검증(http/https 만, 제목 40자)은 서버 코드(lib/custom-links)에서, DB 는 배열·개수만 막는다.
-- 권한: users 기존 표 단위 GRANT·RLS 를 그대로 따른다(칸 단위 GRANT 없음). 읽고 쓰는 곳은 서버(service role)뿐.
alter table public.users add column if not exists custom_links jsonb not null default '[]'::jsonb;
alter table public.users drop constraint if exists users_custom_links_array;
alter table public.users add constraint users_custom_links_array
  check (jsonb_typeof(custom_links) = 'array' and jsonb_array_length(custom_links) <= 5);
