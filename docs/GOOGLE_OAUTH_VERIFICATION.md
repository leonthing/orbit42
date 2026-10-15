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
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | 민감 | 연결할 캘린더 목록 조회(calendarList.list)만 |
| `https://www.googleapis.com/auth/calendar.events` | 민감 | 일정 읽기(캘린더 보기·빈 시간 계산·옵트인 관계 지도) + 예약 확정 일정 반영 + 사용자가 직접 하는 일정 만들기·고치기·지우기·다른 캘린더 이동(반복 한 회차/전체) + 참석자 초대·변경 알림(사용자 확인 뒤) |

> 2026-10-15: 설명을 지금 동작으로 갱신 — 사용자가 직접 하는 구글 일정 만들기·고치기·지우기·다른 캘린더 이동(반복 한 회차/전체), 참석자 초대·변경 알림(확인 뒤), 초대 일정 삭제 시 구글의 불참 응답. 권한 범위는 그대로이고 Console 동의 화면은 바꾸지 않았다(바꾸면 재검증). 다음 검증·연간 재심사 때 이 설명을 쓴다.

> 2026-10-07: Google 체크리스트 메일(최소 권한) 대응으로 `calendar.readonly` → `calendar.calendarlist.readonly` 로 좁혔다. 일정 읽기는 `calendar.events` 가 포함한다. 개인정보 처리방침 11항에 Google 사용자 데이터(접근·사용·공유·보호·보관/삭제 + Limited Use 문구, 한/영)를 추가했다.

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

### calendar.calendarlist.readonly — Korean
> 사용자가 Google 캘린더를 연결하면, Orbit42는 사용자의 캘린더 목록(이름·색·
> 접근 권한)만 읽어 기본 캘린더를 연결하고, 사용자가 설정에서 다른 캘린더를
> 골라 추가할 수 있게 목록을 보여 줍니다. 캘린더 목록을 바꾸지는 않습니다.

### calendar.calendarlist.readonly — English
> When a user connects Google Calendar, Orbit42 reads only the user's calendar
> list (names, colors, access role) to link the primary calendar and to show
> the list in Settings so the user can choose other calendars to add. We never
> modify the calendar list.

### calendar.events — Korean
> Orbit42는 사용자가 자신의 일정을 한 화면에서 관리하고 예약 가능한 시간을
> 공개하는 서비스입니다. 이 권한으로 다음을 합니다.
>
> 1. 읽기: 사용자가 고른 캘린더의 일정을 읽어 앱의 캘린더(월·주·하루 보기)에
>    표시하고, 다른 사람이 예약할 수 있는 빈 시간을 계산합니다.
> 2. 예약 반영: 다른 사용자가 호스트의 시간을 예약하면 확정된 예약을 호스트
>    (및 게스트)의 Google 캘린더에 일정으로 만들고, 예약이 변경·취소되면 그
>    일정을 고치거나 지웁니다.
> 3. 사용자가 직접 하는 편집: 사용자가 Orbit42에서 직접 Google 캘린더 일정을
>    만들거나 고치거나(수정 화면, 끌어서 옮기기·늘리기, 다른 날로 옮기기)
>    지우거나 다른 캘린더로 옮기면, 그 요청대로 반영합니다. 반복 일정은 사용자가
>    고른 범위(이 일정만 / 모두)대로 한 회차 또는 시리즈 전체에 반영합니다.
> 4. 참석자: 사용자가 일정에 참석자를 추가하면 Google이 초대 메일을 보냅니다.
>    참석자가 있는 일정의 시간을 바꿀 때는 사용자에게 알림 여부를 먼저 묻고,
>    사용자가 고른 경우에만 Google이 참석자에게 변경 메일을 보냅니다. 초대받은
>    일정을 지우면 Google이 주최자에게 불참 응답을 보낼 수 있습니다.
> 5. 관계 지도(선택): 사용자가 "오르빗" 화면에서 직접 켠 경우에만(기본값 꺼짐),
>    지난 6개월 본인 일정의 참석자 이름·이메일을 읽어 본인만 보는 관계 지도
>    (누구를 언제 만났고 얼마나 시간을 함께 썼는지)를 만듭니다. 참석자에게는
>    아무것도 전송되지 않고 다른 사용자에게 공개되지 않으며, 기능을 끄면 가져온
>    만남 기록이 삭제됩니다.
>
> 모든 쓰기는 예약 확정이나 사용자 본인의 명시적인 조작이 있을 때만 일어나며,
> 사용자가 조작하지 않은 일정은 건드리지 않습니다. Google 일정의 제목·시각은
> 서비스에 복사해 두지 않고, 사용자가 일정에 남긴 알림·중요도·별점·다시 알림만
> Google 일정 식별자와 함께 저장합니다.

### calendar.events — English
> Orbit42 lets users manage their schedule in one place and publish bookable
> time slots. We use this scope to:
>
> 1. Read: read events on the calendars the user selected to render the in-app
>    calendar (month, week and day views) and compute which time slots are free
>    for others to book.
> 2. Reflect bookings: when another user books a host's time, create the
>    confirmed meeting on the host's (and guest's) Google Calendar, and patch or
>    delete that event if the booking is rescheduled or canceled.
> 3. User-initiated edits: when the user creates, edits (edit screen, drag to
>    move or resize, move to another day), deletes or moves a Google Calendar
>    event to another calendar in Orbit42, apply exactly that change. For
>    recurring events, the change applies to the occurrence or the whole series,
>    as the user chooses ("this event" / "all events").
> 4. Attendees: when the user adds attendees, Google sends them an invitation.
>    When changing the time of an event that has attendees, Orbit42 first asks
>    the user whether to notify them, and Google emails attendees only if the
>    user chooses to. Deleting an event the user was invited to may make Google
>    send a decline to the organizer.
> 5. Relationship map (optional): only if the user turns it on from the "Orbit"
>    screen (off by default), read the attendee names and email addresses of
>    the user's own meetings from the past 6 months to build a private
>    relationship map visible only to that user. Nothing is sent to attendees,
>    the data is never shown to other users, and turning the feature off
>    deletes the imported meeting records.
>
> Every write happens only on a confirmed booking or an explicit action by the
> user; we never modify events the user did not act on. We do not copy event
> titles or times into our database; we store only the reminders, importance,
> ratings and follow-up reminders the user sets on an event, keyed by the
> Google event ID.

---

## 3. 데모 영상 스크립트 (요건: 영문 권장, 비공개/일부공개 YouTube 링크)

Google은 영상에서 ① 동의화면에 우리 앱 이름/스코프가 뜨는 장면, ② 각 스코프가
실제로 쓰이는 인앱 기능을 모두 보여줄 것을 요구한다. 한 영상으로 3~5분이면 충분.

1. `https://orbit42.org` 진입 → "Google로 계속하기"로 로그인. 이때 동의화면은
   이메일·프로필만 요청한다(캘린더 아님) — 그대로 지나가도 된다.
2. 설정 → Google → **"Google 캘린더 연결"** 클릭. 여기서 뜨는 **OAuth
   동의화면**에 앱 이름 "Orbit42"와 캘린더 스코프 2개가 보이도록 천천히
   캡처한다(이 장면이 필수). 이미 연결돼 있으면 먼저 연결 해제 후 다시 연결.
3. 동의 후 앱으로 복귀.
4. **calendar.calendarlist.readonly**: 설정에서 Google 캘린더 목록이 보이고,
   다른 캘린더를 골라 추가하는 모습.
5. **calendar.events (읽기)**: `/[username]/calendar` 에 Google 일정이
   표시되는 모습 + 타임슬롯의 예약 가능 시간이 기존 일정을 피해 계산되는 모습.
6. **calendar.events (예약 반영)**: 다른 계정(시크릿 창)으로 내 슬롯을 예약 →
   확정 → google.com/calendar 에 일정이 생긴 것을 보여줌. 이어 예약 취소 →
   해당 일정이 사라지는 것까지.
7. **calendar.events (직접 편집)**: 앱에서 Google 캘린더에 일정을 만들고 →
   시간을 옮기고 → 참석자를 추가(초대 메일) → 시간 변경 때 "참석자에게 알림"
   확인 창 → 지우기. 반복 일정은 "이 일정만"으로 한 회차를 고치는 장면 하나.
   각 단계마다 google.com/calendar 에 그대로 반영되는 것을 보여줌.
8. (권장 — justification 에 적었으므로) 오르빗: `/[username]/people` 에서 "구글 캘린더에서 찾기"를 눌러
   옵트인 → 참석자가 제안으로 뜨고 → 추가 → 끄기를 누르면 가져온 기록이
   지워지는 것까지.
9. 마무리: 설정에서 Google 연동 해제(권한 회수) 동작 한 번.

영상 설명란에 "Demo for Orbit42 OAuth verification — scopes:
calendar.calendarlist.readonly, calendar.events"를 적어두면 검토가 매끄럽다.

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
