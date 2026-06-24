# Google OAuth 검증 제출 가이드 (Orbit42)

테스트(Testing) 모드 → 정식(In production) 전환 시, 민감(sensitive) 스코프
사용 때문에 Google의 OAuth 검증을 한 번 통과해야 한다. **Calendar / Contacts
스코프는 "민감(sensitive)" 등급으로, 유료 보안감사(CASA)가 필요한 "제한
(restricted)" 등급이 아니다.** 따라서 비용 없이 동의화면 검토 + 정당성 설명 +
데모 영상만으로 통과한다.

리드타임이 가장 길므로(보통 수 주 ~ 2개월) 이 제출을 **가장 먼저** 거는 것을 권장.

---

## 0. 우리가 실제로 요청하는 스코프

| 스코프 | 등급 | 앱에서 쓰는 곳 |
|---|---|---|
| `openid` / `userinfo.email` / `userinfo.profile` | 비민감 | Google 로그인/가입 |
| `https://www.googleapis.com/auth/calendar.readonly` | 민감 | 캘린더 목록·이벤트 읽어 주간 뷰 표시 |
| `https://www.googleapis.com/auth/calendar.events` | 민감 | 예약 확정 시 사용자 Google 캘린더에 이벤트 생성/수정/삭제 |

> `contacts.readonly`는 네트워크/친구찾기 기능을 보류하면서 요청 스코프에서
> 제외했다. 기능이 돌아오면 `src/lib/google.ts`의 SCOPES, `/privacy` 고지,
> 이 문서를 함께 복원할 것.

> 제출 전 확인: Google Cloud Console의 "Data access(스코프)" 목록에 위
> 캘린더 2개 + 로그인 스코프만 등록돼 있고, **Gmail/Drive/Contacts 스코프는
> 없어야** 한다(우리는 안 씀). 개인정보 처리방침에서도 Gmail 언급을 제거했다.

---

## 1. Console 설정 (APIs & Services → OAuth consent screen)

- User type: **External**
- App name: **Orbit42**
- User support email: `orbit42@nthing.net`
- App logo: Orbit42 로고 (업로드 시 별도 브랜드 검토가 붙을 수 있음)
- Application home page: `https://orbit42.org`
- Privacy policy URL: `https://orbit42.org/privacy`
- Terms of service URL: `https://orbit42.org/terms`
- Authorized domains: `orbit42.org`
- Developer contact: `orbit42@nthing.net`
- Authorized redirect URIs (OAuth client): `https://orbit42.org/api/google/callback`
  - 로컬 개발용 `http://localhost:3000/api/google/callback`은 같이 등록해도 됨.

도메인 소유권은 Google Search Console에서 `orbit42.org`를 인증해 두어야 한다
(보통 이미 돼 있음).

---

## 2. 스코프별 Justification (그대로 붙여넣기용)

### calendar.readonly — Korean
> Orbit42는 사용자가 자신의 일정을 한 화면에서 관리하고 공유 가능한 시간을
> 등록하는 서비스입니다. 사용자가 Google 캘린더를 연동하면, 본인의 캘린더
> 목록과 이벤트를 읽어 앱 내 주간 캘린더 뷰에 표시하고 예약 가능한 시간대를
> 계산합니다. 읽기 전용 접근만으로 이 표시·계산 기능을 제공합니다.

### calendar.readonly — English
> Orbit42 lets users manage their schedule in one place and publish bookable
> time slots. When a user connects their Google Calendar, we read their
> calendar list and events to render the in-app weekly calendar view and to
> compute which time slots are free for others to book. Read-only access is
> used solely to display and reconcile the user's own availability.

### calendar.events — Korean
> 다른 사용자가 호스트의 시간을 예약하면, Orbit42는 확정된 예약을 호스트(및
> 게스트)의 Google 캘린더에 이벤트로 생성합니다. 예약이 변경·취소되면 해당
> 이벤트를 수정하거나 삭제합니다. 쓰기 권한은 오직 사용자 본인이 만든 예약을
> 캘린더에 반영하기 위해서만 사용되며, 사용자의 다른 이벤트는 건드리지
> 않습니다.

### calendar.events — English
> When another user books a host's time on Orbit42, we create a corresponding
> event on the host's (and guest's) Google Calendar so the confirmed meeting
> appears in their calendar. If a booking is rescheduled or canceled, we patch
> or delete that specific event. Write access is used only to reflect the
> user's own bookings; we never modify the user's unrelated events.

---

## 3. 데모 영상 스크립트 (요건: 영문 권장, 비공개/일부공개 YouTube 링크)

Google은 영상에서 ① 동의화면에 우리 앱 이름/스코프가 뜨는 장면, ② 각 스코프가
실제로 쓰이는 인앱 기능을 모두 보여줄 것을 요구한다. 한 영상으로 3~5분이면 충분.

1. `https://orbit42.org` 진입 → "Continue with Google" 클릭.
2. **OAuth 동의화면**이 뜨고 앱 이름 "Orbit42"와 요청 스코프 목록이 화면에
   보이도록 천천히 캡처(이 장면이 필수).
3. 동의 후 앱으로 복귀.
4. **calendar.readonly**: 설정에서 Google 캘린더 연동 → `/[username]/calendar`
   주간 뷰에 Google 이벤트가 표시되는 모습.
5. **calendar.events**: 예약 슬롯에서 예약을 생성 → 확정 → 사용자 Google
   캘린더(google.com/calendar)에 이벤트가 생성된 것을 보여줌. 이어 취소 →
   해당 이벤트가 사라지는 것까지.
6. 마무리: 설정에서 Google 연동 해제(권한 회수) 동작 한 번.

영상 설명란에 "Demo for Orbit42 OAuth verification — scopes: calendar.readonly,
calendar.events"를 적어두면 검토가 매끄럽다.

---

## 4. 제출 후 동작

- 제출하면 status가 "In review"가 되고, 그 사이에도 기존 테스트 사용자는 계속
  쓸 수 있다.
- "In production"으로 전환했지만 아직 미검증인 상태로 두면, 신규 사용자에게
  "Google에서 확인하지 않은 앱" 경고가 뜨고 **민감 스코프 사용자 100명
  상한**이 걸린다. 즉, 100명을 넘기기 전에 검증 통과가 필요하다.
- Google이 추가 자료(스코프 축소, 정책 문구 보강 등)를 요청할 수 있으니
  `orbit42@nthing.net` 메일을 주시.

---

## 5. 제출 전 체크

- [ ] Console Data access 목록 = 캘린더 2개 + 로그인 스코프뿐 (Gmail/Drive/Contacts 없음)
- [ ] Privacy(`/privacy`)에 Calendar 사용 고지 명시 (Gmail/Contacts 미요청)
- [ ] Terms(`/terms`) 접근 가능
- [ ] Authorized domain `orbit42.org` + Search Console 소유권 인증
- [ ] Production redirect URI `https://orbit42.org/api/google/callback` 등록
- [ ] 데모 영상(YouTube 비공개) 링크 준비
- [ ] 스코프별 justification 붙여넣기
