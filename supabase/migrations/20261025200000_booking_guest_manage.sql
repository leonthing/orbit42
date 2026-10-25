-- 게스트 예약 관리 링크 (개선-40, 1.6.0 ②) — 칸 추가만.
-- guest_manage_token_hash: 관리 링크 토큰의 sha256(hex). 토큰 원문은 저장하지 않는다(게스트 메일에만).
-- reschedule_by_guest: 계정 없는 게스트가 관리 링크로 시간 변경을 제안했음(reschedule_by 는 계정 id 라 비어 있다).
alter table public.bookings add column if not exists guest_manage_token_hash text;
create unique index if not exists bookings_guest_manage_token_hash_key
  on public.bookings (guest_manage_token_hash) where guest_manage_token_hash is not null;
alter table public.bookings add column if not exists reschedule_by_guest boolean not null default false;
