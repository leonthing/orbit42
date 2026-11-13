# 1.9.0 심사 메모 초안 (appStoreReviewDetail.notes — ASC 미반영)

앞부분(앱 소개·데모 계정 appreview·[결제 관련])과 기존 확인 경로는 1.8.0 메모 그대로 두고, 아래 [1.9.0]을 더한다.

## PO 결정 (11/13)
- **수동 출시, 11/20 0시(KST) 이후.** 승인돼도 바로 내지 않는다 → 새 기능 문구에 '11월 20일부터' 안 붙임.
- 심사 상대 계정 A·B 만들기(아래), env 추가·재배포는 Leo 지시 때.
- 스크린샷: s190-2(후속 칸)를 기존 첫 장 바로 뒤(2번째)에 넣는다. 첫 장은 그대로, s190-1(대화방)은 안 넣는다.
- /admin 신고 목록은 제출 전에 넣는다(3182e1d, 배포 대기).

## 확인한 사실 (11/13)
- 운영 Vercel env `V190_PREVIEW_USER_IDS`에 appreview 계정 id(90a69d23…)가 들어 있다(11/13 02:4x 설정, 운영 DB의 appreview id와 앞 8자리 일치 확인). → 11/20 전 심사여도 appreview로 로그인하면 1:1 대화·할 일·후속이 열린다.
  - 운영 로그인 토큰을 로컬에서 만들 수 없어 appreview로 운영 앱에 직접 들어가 보지는 못함. Leo 폰(같은 미리보기) 확인 결과로 갈음하거나, 제출 전 TestFlight에서 appreview로 한 번 로그인해 대화 칸이 보이는지 확인 필요.
- **미리보기 중 1:1 대화는 '미리보기 계정끼리만' 된다**(v190OpenPair). 그래서 심사용 상대 계정도 env에 넣어야 한다 → env 변경 + 재배포 = Leo 승인 필요.
- 신고가 들어오면 운영자 계정(ADMIN_USERNAMES, 운영에 설정돼 있음)에 앱 알림 "1:1 대화 신고가 들어왔어요"가 가고 링크는 /admin. **그런데 /admin에 신고 목록 화면이 없다**(message_reports 를 보는 곳이 DB뿐). UGC 1.2는 신고에 대한 조치 수단을 요구하므로 제출 전에 /admin 신고 목록(+대상 메시지·처리 완료) 추가를 권장.

## 심사용 상대 계정 — 제안 (결정: PO, 실행: Leo 승인 뒤)
- 권장: **상대 계정 2개**를 데모로 만든다(가상 이름, 실명 금지, 예: 표시명 '도윤'·'서연', 아이디는 운영에 없는 것 확인함 — reviewpartner 등 미사용).
  1. 상대 A — appreview와 서로 팔로우, **이미 열린 대화**(3~4줄). 대화방·예약 링크 보기·글 보내기 확인용.
  2. 상대 B — appreview에게 **받은 대화 요청** 1건. 수락·거절·신고·차단을 심사자가 눌러 볼 수 있다(A를 차단하면 열린 대화 데모가 망가지니 차단은 B로 안내).
- 두 계정 id를 `V190_PREVIEW_USER_IDS`에 추가하고 재배포(11/20 이후엔 필요 없음).
- 심사가 끝나면(또는 11/20 뒤 일정 시점) 두 계정을 지울지 남길지 PO 결정. 남기면 다음 심사에도 재사용.
- 상대 계정 알림 메일은 example.com 같은 받는 곳 없는 주소 대신 Leo가 정한 내부 주소로(가입 시 이메일 필요).

## 심사 상대 계정 — 만들어 둠 (11/13, 운영 DB)
- A: 아이디 demodoyun, 표시명 '도윤', 이메일 review-a@orbit42.org(인증 표시). appreview와 서로 팔로우, 열린 대화 4줄(마지막은 appreview).
- B: 아이디 demoseoyeon, 표시명 '서연', 이메일 review-b@orbit42.org(인증 표시). appreview에게 대화 요청 1건(첫 메시지 1줄).
- 알림·푸시·메일이 appreview에게 가지 않게 DB에 바로 넣었다(읽음 처리 포함). 두 계정 비밀번호는 무작위로 만들고 저장하지 않았다(로그인할 일 없음, 필요하면 재설정).
- 실명 대조: 운영에 '도윤'·'서연' 표시명 0명, 아이디·이메일 미사용 확인.
- **아직 env에 없어서 appreview 화면에는 안 보인다.** Leo 지시 때 V190_PREVIEW_USER_IDS에 A·B id 추가 → 재배포.
- 주의: 공개 계정이라 검색·추천에 보일 수 있다(appreview와 같음). 11/20 뒤 지울지 PO 결정.
- B 요청은 30일 뒤(12/13) 정리 cron이 지운다 — 심사가 그 뒤로 밀리면 다시 넣는다.

## [1.9.0] 메모 본문 (ko)
0) 출시는 11월 20일 이후 수동으로 합니다(개인정보처리방침 개정 시행일). 심사 계정 appreview는 그 전에도 새 기능이 열려 있습니다.
1) 1:1 대화: '예약' 탭 → 위의 '대화' → '도윤'(데모 상대)과의 대화. 위의 '도윤님의 예약 링크 보기'로 상대의 예약 링크가 열립니다. 서로 팔로우하거나 예약한 사이는 바로 대화하고, 그 밖의 사용자에게는 프로필의 '대화' 버튼으로 첫 메시지와 함께 요청을 보냅니다(하루 5건까지).
2) 받은 요청: 같은 목록의 '서연'(데모 상대)이 보낸 요청을 누르면 '수락·거절·신고·차단' 버튼이 있습니다.
3) 신고·차단(가이드라인 1.2): 대화방에서 상대 메시지를 길게 누르면 '신고', 오른쪽 위 '…' 메뉴에 '차단'·'나가기'가 있습니다. 상대 프로필 오른쪽 위 메뉴에서도 차단할 수 있습니다. 차단하면 서로 대화·팔로우·예약이 막힙니다. 신고는 운영자에게 바로 알려지고 확인 후 조치합니다. 이용약관 제8조(금지 행위)와 제9조(위반 콘텐츠 삭제·이용 제한)에 기준을 적어 두었습니다.
4) 후속: '캘린더' 탭 → 제출일 오전의 '브랜드 디자인 리뷰'(데모) → 일정 상세의 '후속' 칸. '후속 일정'·'할 일' 버튼으로 이어서 만들고, '완료로 표시'를 누르면 후속을 바로 묻는 창이 뜹니다(설정에서 끌 수 있음).
5) 메모 → 할 일: 같은 일정의 메모에 '-'로 시작하는 줄이 있으면 메모 아래 '할 일로 바꾸기 (N)' 버튼이 보입니다.
6) 할 일 목록: '캘린더' 탭 오른쪽 위 체크 목록 아이콘. 하루 보기 맨 위에도 그날 할 일이 보입니다.

## [1.9.0] notes (en)
0) We will release manually after November 20 (the effective date of our updated privacy policy). The review account appreview already has the new features enabled.
1) 1:1 messages: Bookings tab → "대화" (Chats) at the top → conversation with "도윤" (demo partner). "View booking link" at the top opens the partner's booking page. Mutual followers or people with a booking can chat directly; anyone else receives a request with a first message (up to 5 per day).
2) Incoming request: the request from "서연" (demo partner) shows Accept / Decline / Report / Block.
3) Report & block (Guideline 1.2): long-press a message from the other person to Report; the "…" menu at the top right has Block and Leave. Blocking is also available from the profile menu. Reports are sent to the operator immediately and reviewed. Prohibited conduct and enforcement are described in Terms §8–9.
4) Follow-ups: Calendar tab → today's "브랜드 디자인 리뷰" (demo) → Follow-up section. Tapping "완료로 표시" (Mark as done) offers to add follow-ups right away (can be turned off in Settings).
5) Notes → to-dos: if a note has lines starting with "-", a "할 일로 바꾸기 (N)" button appears below it.
6) To-do list: checklist icon at the top right of the Calendar tab; today's to-dos also appear at the top of Day view.

## 제출 전 남은 일 (Leo 승인 필요한 것 표시)
- [x] 심사 상대 계정 2개 생성·데모 데이터(대화·요청) — 11/13
- [ ] env에 A·B 추가·재배포 — **Leo 승인**
- [ ] 제출하는 날 appreview에 데모 일정 '브랜드 디자인 리뷰'(그날 오전, 완료 표시·후속 일정 1·할 일 2·메모 '-' 줄 2) 넣기 — PO 결정(11/13)
  - 확인 위치(메모 4·5번): 캘린더 → 그 일정 → 일정 상세 '후속' 칸 / 같은 화면 메모 아래 '할 일로 바꾸기 (N)'
- [x] /admin 신고 목록 화면 개발(3182e1d, 마이그레이션 20261113040000 미적용) — 배포 **Leo 승인**
- [ ] 서버 배포(142902c 첫 글·3182e1d 신고 목록·알림 삭제 + 마이그레이션 20261113040000) — **Leo 승인**
- [ ] 빌드 47(버그-2 3301817·0af146e) TestFlight — **Leo 승인**
