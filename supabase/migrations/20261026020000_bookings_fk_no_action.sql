-- 예약 데이터 보호 (개선-45, CEO 10/26) — 예약 링크·수동 시간 창을 지워도 예약이 함께 지워지지 않게.
-- bookings.slot_id·availability_id 의 ON DELETE CASCADE → NO ACTION(예약이 걸린 링크·시간 창 단독 삭제는 거절).
-- RESTRICT 가 아니라 NO ACTION: 문장 끝에 검사하므로 호스트 탈퇴(users 삭제 → time_slots·bookings 가 함께 연쇄 삭제)는 그대로 된다.
-- 데이터는 바뀌지 않고 제약 정의만 바뀐다. 적용 전 백업: 저장소 밖 ~/orbit42-backups/20261026-fk-noaction (7일 안에 삭제).
alter table public.bookings
  drop constraint if exists bookings_slot_id_fkey,
  add constraint bookings_slot_id_fkey
    foreign key (slot_id) references public.time_slots(id) on delete no action;
alter table public.bookings
  drop constraint if exists bookings_availability_id_fkey,
  add constraint bookings_availability_id_fkey
    foreign key (availability_id) references public.slot_availabilities(id) on delete no action;
