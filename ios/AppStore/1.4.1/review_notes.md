# 1.4.1 심사 메모 초안 (제출 때 appStoreReviewDetail.notes 에 넣음 — 아직 ASC 미반영)

앞부분(앱 소개·[결제 관련])과 1)~6)은 1.4.0 메모 그대로 둔다. 7)·8)을 아래로 바꾸고 9)~11)을 더한다.

[1.4.1 변경 확인 경로]
7) 보관: '캘린더' 탭 → 아무 일정 → 일정 상세 오른쪽 위 '…' → '보관'. 목록과 하루 보기에서 흐리게(회색 '보관' 표시) 보입니다. 같은 메뉴의 '보관 해제'로 되돌립니다. 일정 상세 오른쪽 위 연필 아이콘은 수정, 왼쪽 위 X는 닫기입니다.
8) 일정을 다른 날로 옮기기는 일정 상세 → 연필(수정) → 날짜 변경 → '저장'으로 합쳤습니다(1.4.0의 '다른 날로' 버튼은 없앴습니다).
9) 하루 보기에서 끌어 옮기기·늘리기: '캘린더' 탭 → 오른쪽 위 달력 아이콘 → 하루 보기 → 10월 20일로 넘깁니다. 일정 블록을 0.4초쯤 꾹 누르면 떠오르고, 위아래로 끌면 15분 단위로 시간이 바뀝니다(끄는 동안 새 시각 표시). 손을 떼면 저장됩니다. 블록 아래 끝을 꾹 눌러 끌면 끝 시각만 바뀝니다. 예약에서 생긴 일정(예약 탭의 예약)은 끌리지 않고, 일정 상세의 '예약에서 관리'로 그 예약으로 이동합니다.
10) 빈 곳 꾹 눌러 새 일정: 하루 보기의 빈 시간을 꾹 누르면 그 시각(15분 단위)으로, 월 보기의 날짜를 꾹 누르면 그 날짜로 '새 일정' 화면이 열립니다.
11) 캘린더 선택: '새 일정'·'일정 수정' 화면의 제목 바로 아래 '캘린더'에 사용자의 캘린더가 버튼으로 모두 보이고, 하나를 눌러 고릅니다(고른 것은 색으로 채워지고 체크 표시).

참고: 데모 계정은 Google 캘린더가 연결돼 있지 않아, 참석자가 있는 Google 일정의 시간 변경 확인창("참석자에게 구글 캘린더 변경 알림이 갑니다")과 초대받은 Google 일정 화면("주최자만 수정할 수 있어요", "내 캘린더에서 빼기")은 데모 계정으로는 보이지 않습니다. 확인하려면 6)처럼 심사자 본인 Google 계정을 연결해 주세요.

---
## 영문 요약(필요 시 함께)
9) Day view: press and hold an event (~0.4s) to lift it, drag up/down to move it in 15-minute steps; drag its bottom edge to change the end time. 10) Press and hold an empty time slot (Day view) or a date (Month view) to open New Event at that time/date. 11) In New/Edit Event, all calendars are shown as buttons right below the title. The demo account has no Google Calendar connected, so the guest-notification confirm and invited-event screens appear only after connecting your own Google account (see 6).

## 데모 데이터 판단
- appreview 입금 대기 예약(최하린 10/28, 입금 기한 10/27): 제출을 10/15~16에 하면 심사(보통 1~2일)가 10/24 전에 끝날 가능성이 커 지금은 그대로 둔다.
- 늦어지면 제출일에 연장: 테스트 스크립트로 bookings.payment_due_at·scheduled_at 을 뒤로 미는 update 1건(10/13에 한 방식). 하루 보기 데모(10/20 겹치는 일정 2개)도 10/20이 지나면 날짜를 옮겨야 한다.

## 스크린샷
- 1.4.0 것 유지. 지금 세트(iPhone 8장·iPad 6장)에 일정 상세 화면이 없어(예약 상세·캘린더 월 보기·위젯 등) 바뀐 버튼 위치가 드러나지 않는다.
