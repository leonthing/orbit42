# App Store 제출 준비 (v1.0.0)

## 상태
- [x] Release 아카이브 빌드 검증 완료 (2026-07-28)
- [x] 앱 아이콘·PrivacyInfo 번들 포함 확인 (project.yml sources 단일화)
- [x] 개인정보처리방침/이용약관 웹 페이지 + 앱 내 링크
- [x] 로그인 3종 (이메일·Google·Apple — App Store 4.8 충족)
- [x] 온보딩 알림 권한 / 위치 권한 컨텍스트 요청 (권한 사용 문구 plist 등록)
- [ ] **App Store Connect 앱 레코드 생성 (Leo)** — appstoreconnect.apple.com > 나의 앱 > + 신규 앱
  - 플랫폼 iOS / 이름 `orbit42` / 기본 언어 한국어 / 번들 ID `org.orbit42.app` / SKU `orbit42-ios`
- [ ] 레코드 생성 후: 아카이브 → 업로드 (`ExportOptions.plist` 준비됨, 명령은 아래)
- [ ] 스크린샷 촬영 (아래 목록)
- [ ] 심사 제출

## 업로드 명령 (레코드 생성 후)
```bash
cd ios
xcodegen generate
xcodebuild -project Orbit42.xcodeproj -scheme Orbit42 -configuration Release \
  -destination "generic/platform=iOS" -archivePath build/Orbit42.xcarchive archive \
  -allowProvisioningUpdates
xcodebuild -exportArchive -archivePath build/Orbit42.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/export \
  -allowProvisioningUpdates
```

## 메타데이터 초안
- **이름**: orbit42
- **부제(30자)**: 시간을 자산으로 만드는 캘린더
- **설명 초안**:
  시간은 매일 주어지는 가장 공평한 자산이에요. orbit42는 캘린더에 쌓인 내 시간을
  돈으로 환산해 보여주고, 남는 시간을 타임슬롯으로 만들어 팔 수 있는 시간 자산 앱입니다.
  - 캘린더: 구글 캘린더 연동, 일정마다 시간 가치(₩) 표시, 위치·이동시간·참석자 초대
  - 자산: 이번 달 시간으로 번 돈, 주간 리포트, 수입·투자·소비·생활 분석, 주간 목표
  - 타임슬롯: 커피챗·멘토링 등 내 시간을 예약 가능한 상품으로 — 무료부터 경매까지
  - 오르빗: 팔로우한 사람들의 열린 시간과 새 소식이 모이는 공간
- **키워드(100자)**: 캘린더,시간관리,타임슬롯,커피챗,멘토링,예약,시급,자산,생산성,프리랜서
- **지원 URL**: https://orbit42.org
- **개인정보처리방침 URL**: https://orbit42.org/privacy
- **연령 등급**: 4+ (해당 없음 전부 체크)
- **카테고리**: 생산성 (보조: 소셜 네트워킹)

## 심사 노트 (App Review Information)
- 데모 계정: 심사 제출 전에 전용 계정 생성 필요 (예: appreview / 비밀번호 별도 생성)
  — 팔로우·슬롯·일정이 미리 채워진 상태로 준비할 것
- Google 캘린더 연동은 선택 기능 — 데모 계정은 로컬 캘린더로 시연 가능하다고 명시
- 결제: 현재 앱 내 결제 없음 (예약은 오프라인/무료 — payment_method offline)

## 스크린샷 (6.7" 필수, 6.1" 권장 — 각 3~6장)
1. 캘린더 월 보기 (일정 + 금액 배지)
2. 자산 탭 (이번 달 번 돈 + 판매 현황)
3. 타임슬롯 상세 (미니 캘린더 미리보기)
4. 오르빗 탭 (팔로우 사람들 + 최근 활동)
5. 일정 상세 (위치 지도 + 참석자)
6. 프로필

## App Privacy (수집 항목 신고)
- 연락처 정보: 이메일 주소 (계정 기능) — 사용자에게 연결됨
- 사용자 콘텐츠: 사진/동영상(프로필·슬롯 이미지), 기타(일정·프로필) — 연결됨
- 식별자: 사용자 ID — 연결됨
- 위치: **수집 안 함** (권한은 주소 검색 결과 정렬에만 사용, 기기 밖 전송 없음
  — 일정에 저장되는 위치는 사용자가 입력한 텍스트/좌표로 "사용자 콘텐츠"에 해당)
- 추적: 없음 (제3자 광고/트래킹 SDK 없음)

## 이번 버전에서 보류된 기능 (코드/서버는 유지, UI만 숨김)
- 시간 로그 (일정 사진 → 프로필 그리드 / 오르빗 스트림 노출)
- APNs 푸시 (권한 요청만 온보딩에 포함)
