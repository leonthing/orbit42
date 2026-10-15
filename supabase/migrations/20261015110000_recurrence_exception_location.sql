-- '이 일정만' 수정의 장소 좌표·이동시간(1.5.1). 추가만 — null = 시리즈 값 그대로.
alter table public.event_recurrence_exceptions add column if not exists location_lat double precision, add column if not exists location_lng double precision, add column if not exists travel_min integer;
