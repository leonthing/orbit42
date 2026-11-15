# 1.10.0 심사 메모 초안 (appStoreReviewDetail.notes — ASC 미반영, 제출은 PO·Leo 결정 뒤)

앞부분(앱 소개·데모 계정 appreview·[결제 관련])과 1.9.0까지의 확인 경로는 그대로 두고, 아래 [1.10.0]을 맨 앞에 더한다(새 경로를 앞에 — 1.5.3 때 정한 방식).

## 확인한 사실 (11/15)
- 운영 `POSTS_PREVIEW_USER_IDS` = leokim·appreview·도윤(demodoyun)·서연(demoseoyeon). `POSTS_PUBLIC` 없음(꺼짐) → **appreview로 로그인하면 글·사진이 열리고**, 도윤·서연의 글도 보인다(미리보기 계정끼리).
- 신고는 message_reports(kind=post)로 들어가고 운영자 알림 → /admin/reports 에서 처리(1.9.0 때 만든 목록이 글 신고도 보여 줌).
- 차단은 상대 프로필 '…' → '차단 해제'로 되돌릴 수 있다(앱 PersonProfileView).
- 빌드 51(feat/1.10.0-ios-posts 468ba1b, 로컬 아카이브 ios/build/Orbit42-1.10.0-51.xcarchive)에는 명함 코드·카메라 권한 문구가 없다(strings 0건, VisionKit 링크 없음, NSCameraUsageDescription 없음).

## 제출하는 날 할 일 (데모 데이터 — PO 지시로 지금은 0)
- 도윤 계정에 **전체 공개 글 1개**(가상 사진 3장 + 서식 있는 본문, 링크 페이지 고정) — 심사자가 하트·신고·차단을 눌러 볼 대상.
- 서연은 차단 시험용으로 안내(도윤을 차단하면 1.9.0 열린 대화 데모가 끊긴다 → 차단은 서연 쪽 글로 안내하려면 서연에게도 공개 글 1개).
- 심사 뒤(출시 뒤) 위 데모 글·하트·신고를 0으로 정리.

## [1.10.0] 메모 본문 (ko)
0) 글·사진은 개인정보처리방침 개정 시행(11월 27일) 뒤 모든 분께 열립니다. 심사 계정 appreview에는 지금 열려 있습니다. 출시는 그 뒤 수동으로 합니다.
1) 글 쓰기: '프로필' 탭 → '글·사진' → 오른쪽 위 '+'. 사진(최대 10장, 사진 속 위치 정보는 올리기 전에 지웁니다)과 글을 쓰고 '올리기'. '취소'를 누르면 '나만 보기로 임시 저장'을 고를 수 있습니다.
2) 다른 사람의 글 보기: '오르빗' 탭 → 검색에 demodoyun → '도윤' 프로필 → '글·사진' → 글. 하트를 누를 수 있습니다.
3) 신고·차단(가이드라인 1.2): 남의 글 오른쪽 위 '…' → '신고하기'(사유 4가지) / '○○님 차단하기'. 신고는 운영자에게 바로 알려지고 24시간 안에 확인해 글을 숨기거나 이용을 제한합니다. 차단하면 서로의 글·대화·예약이 막히고, 상대 프로필 '…'에서 차단을 풀 수 있습니다. 기준은 이용약관 제8조·제9조에 있습니다.
4) 내 글 관리: 내 글 오른쪽 위 '…' → 고치기·나만 보기로 바꾸기·링크 페이지 맨 위에 고정·삭제.

## [1.10.0] notes (en)
0) Posts open to everyone after our updated privacy policy takes effect on November 27. They are already enabled for the review account appreview. We will release manually after that date.
1) Write a post: Profile tab → "글·사진" (Posts) → "+" at the top right. Add photos (up to 10; location data is removed before upload) and text, then tap "올리기" (Post). Tapping "취소" (Cancel) offers "Save as private draft".
2) View someone else's post: Orbit tab → search "demodoyun" → "도윤" profile → "글·사진" → a post. You can tap the heart.
3) Report & block (Guideline 1.2): on someone else's post, "…" at the top right → "신고하기" (Report, 4 reasons) / "Block". Reports reach the operator immediately and are reviewed within 24 hours (the post can be hidden or the account restricted). Blocking stops posts, messages and bookings both ways; it can be undone from the person's profile "…" menu. Rules are in Terms §8–9.
4) Manage your post: "…" on your own post → Edit / Make private / Pin to top of link page / Delete.
