-- 1.9.0: 앱 1:1 대화방의 '예약 링크 보기'로 들어온 방문을 출처 범주 'dm' 으로 센다(PO 11/13). 범주 하나 추가만 — 횟수만, 사람 정보 없음.
alter table public.booking_funnel_ref_daily drop constraint if exists booking_funnel_ref_daily_ref_check;
alter table public.booking_funnel_ref_daily
  add constraint booking_funnel_ref_daily_ref_check
  check (ref in ('instagram', 'kakao', 'threads', 'x', 'youtube', 'search', 'orbit42', 'direct', 'other', 'dm'));
