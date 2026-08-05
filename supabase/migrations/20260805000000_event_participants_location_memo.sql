-- 일정 참석자 스냅샷에 장소·메모 추가.
--
-- 초대 메일에는 이미 장소/메모를 실어 보내고 있었지만, 초대받은 쪽 캘린더에
-- 그려지는 항목에는 제목·시간만 남아 "어디서 만나는지"를 메일에서 다시 찾아야
-- 했다. 스냅샷에 함께 저장해 상대 캘린더에서도 보이게 한다.
--
-- 주의: event_participants 테이블 자체는 마이그레이션 없이 만들어져 있어
-- (운영에 수동 생성) 이 파일은 컬럼 추가만 한다. 재실행 가능하도록
-- `if not exists` 를 쓴다.

alter table public.event_participants
  add column if not exists location text,
  add column if not exists description text;

comment on column public.event_participants.location is
  '초대 시점 일정 장소 스냅샷 (자유 텍스트)';
comment on column public.event_participants.description is
  '초대 시점 일정 메모 스냅샷';
