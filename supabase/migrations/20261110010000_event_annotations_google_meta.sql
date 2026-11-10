-- 구글 일정의 Orbit42 부가정보 — 이동시간·지도 좌표·기념일 기준일 (Leo 11/10).
-- 구글 캘린더에는 쓰지 않는다(설명·메모·extendedProperties 포함). 예전에 extendedProperties.private 의
-- orbit42TravelMin·orbit42Lat·orbit42Lng·orbit42Anniversary 에 쓰던 값을 여기로 옮긴다:
--   google_meta_at 이 있으면 이 기록이 그 일정의 값(null = 없음). 없으면 구글에 남은 예전 값을 읽기만 하고,
--   Orbit42 가 그 일정을 다음에 고칠 때 이리 옮겨 담고 구글의 orbit42* 를 지운다(일괄 작업 없음).
-- Orbit42 일정은 기존 events 칸을 그대로 쓴다. 반복 구글 일정은 회차 키에 없으면 시리즈 키(gcal_<master>)를 본다.
-- 기존 테이블에 칸만 더한다 — RLS 는 이미 켜져 있고(정책 없음, 서버 service role 로만 읽고 씀) 권한도 그대로.
alter table public.event_annotations
  add column if not exists travel_min smallint check (travel_min between 1 and 480),
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists anniversary_start date,
  add column if not exists google_meta_at timestamptz;
