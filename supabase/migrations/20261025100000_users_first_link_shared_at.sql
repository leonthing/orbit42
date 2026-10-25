-- 링크 공유 기록 (1.6.0 ① 첫날 다시 짜기) — 예약 링크·링크 페이지 주소를 처음 공유/복사한 시각.
-- 한 번 적으면 덮어쓰지 않는다(서버가 null 일 때만 채움). 지표 '가입 7일 안 링크 공유 비율'에 쓴다. 칸 추가만.
alter table public.users add column if not exists first_link_shared_at timestamptz;
