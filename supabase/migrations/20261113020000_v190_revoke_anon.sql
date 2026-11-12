-- 20261113010000 보완: 새 표(todos·event_follow_ups)와 1:1 대화 표에 anon·authenticated 권한이 기본으로 붙어 있었다
-- (RLS 정책이 없어 읽혀도 0줄, 쓰기는 42501). 보안-8 표와 같게 거둔다. 서버(service_role)만 쓴다 — 앱 코드의 anon 클라이언트는 이 표를 쓰지 않음(11/12 확인).
revoke all on public.todos from anon, authenticated;
revoke all on public.event_follow_ups from anon, authenticated;
revoke all on public.conversations from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.message_reports from anon, authenticated;
