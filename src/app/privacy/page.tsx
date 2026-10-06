import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보처리방침 · Orbit42" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-charcoal-100 hover:text-navy-400"
        >
          Orbit42
        </Link>
        <Link
          href="/terms"
          className="text-sm text-charcoal-400 hover:text-charcoal-100"
        >
          이용약관 →
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <h1 className="text-3xl font-bold text-charcoal-100">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-charcoal-500">
          최종 업데이트: 2026년 10월 7일
        </p>

        <div className="mt-10 space-y-8">
          <Section title="1. 개인정보 수집 항목 및 수집 방법">
            <p>
              주식회사 엔씽(이하 “회사”)은 오르빗42(이하 “서비스”)의 제공을
              위해 아래와 같은 개인정보를 수집합니다.
            </p>
            <SubHead>가. 회원가입 시</SubHead>
            <List>
              <li>이메일, 비밀번호(암호화 저장), 사용자명, 표시명</li>
              <li>
                구글(OAuth)로 가입하는 경우: 이메일, 이름, 프로필 사진(선택)
              </li>
              <li>
                Apple로 가입·로그인하는 경우: 이메일(비공개 릴레이 주소일 수
                있음), 이름(최초 1회), Apple 계정 식별자
              </li>
            </List>
            <SubHead>나. 서비스 이용 시 자동 수집</SubHead>
            <List>
              <li>접속 IP, 브라우저/기기 정보, 쿠키, 접속 시각</li>
              <li>이용자가 입력·업로드한 프로필, 관심사, 경력·학력</li>
              <li>
                이용자가 생성한 콘텐츠: 캘린더 이벤트, 타임슬롯, 서비스 메뉴,
                피드 글, 예약·입찰 내역
              </li>
            </List>
            <SubHead>다. 외부 서비스 연동 시</SubHead>
            <List>
              <li>
                Google Calendar 연동 시: 캘린더 이벤트 읽기/쓰기 권한을 사용해
                이용자의 일정 정보를 조회·생성합니다. 이용자 본인의 캘린더만
                다루며, 서비스가 저장하는 토큰은 암호화되어 관리됩니다.
              </li>
              <li>
                캘린더에서 사람 찾기(오르빗)를 켠 경우: 이용자 본인 캘린더(Google
                Calendar, iPhone 기기 캘린더)의 최근 6개월~향후 2개월 일정 중
                참석자가 있는 일정의 제목·시각과 참석자의 이름·이메일을 저장해
                이용자에게만 보이는 관계 지도를 만듭니다. 기본값은 꺼져 있고,
                참석자에게는 어떤 정보도 전송되지 않으며, 다른 이용자에게
                공개되지 않습니다. 기능을 끄면 캘린더에서 가져온 만남 기록과
                이용자가 고르지 않은 제안은 즉시 삭제됩니다.
              </li>
            </List>
          </Section>

          <Section title="2. 개인정보의 이용 목적">
            <List>
              <li>회원 식별, 계정 관리, 로그인 유지</li>
              <li>서비스 제공: 캘린더 공유, 타임슬롯 등록·예약, 피드, 경매, 이용자 본인의 관계 기록(오르빗)</li>
              <li>서비스 개선 및 통계 분석(개인 식별 불가능한 형태로)</li>
              <li>약관 위반 대응, 고객 문의 응대, 공지 발송</li>
              <li>법령상 의무 이행</li>
            </List>
          </Section>

          <Section title="3. 개인정보의 보유 및 이용 기간">
            <List>
              <li>
                회원 정보: 회원 탈퇴 시 즉시 파기. 단, 아래 법령상 의무가 있는
                정보는 해당 기간 동안 별도 저장소에 분리 보관 후 파기합니다.
                <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-charcoal-600">
                  <li>계약·청약철회 등 기록: 5년(전자상거래법)</li>
                  <li>대금결제·재화공급 기록: 5년(전자상거래법)</li>
                  <li>소비자 불만·분쟁처리 기록: 3년(전자상거래법)</li>
                  <li>로그인 기록: 3개월(통신비밀보호법)</li>
                </ul>
              </li>
              <li>
                쿠키/세션: 세션 유지를 위한 httpOnly 쿠키는 최대 7일까지 저장
                후 자동 만료됩니다.
              </li>
            </List>
          </Section>

          <Section title="4. 개인정보의 제3자 제공">
            <p>
              회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
              다만 아래의 경우 제한적으로 제공됩니다.
            </p>
            <List>
              <li>
                이용자가 공개로 설정한 프로필, 타임슬롯, 피드 글, 캘린더 이벤트는
                다른 이용자에게 노출됩니다.
              </li>
              <li>
                예약 발생 시 호스트와 게스트 간 상호 식별에 필요한 최소한의
                정보(이름, 메시지 등)가 상대에게 전달됩니다.
              </li>
              <li>법령에 근거한 수사기관의 요청이 있는 경우</li>
            </List>
          </Section>

          <Section title="5. 개인정보 처리 위탁 (Processors)">
            <p>
              회사는 서비스 운영을 위해 아래 국외 업체에 개인정보 처리의 일부를
              위탁하고 있습니다. 각 업체는 해당 서비스 제공에 필요한 최소한의
              정보만 처리하며, 관련 계약을 통해 보안 수준을 관리하고 있습니다.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-charcoal-800/60 text-charcoal-400">
                    <Th>수탁자</Th>
                    <Th>위탁 업무</Th>
                    <Th>국가</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800/40 text-charcoal-300">
                  <tr>
                    <Td>Supabase, Inc.</Td>
                    <Td>데이터베이스·인증·스토리지 호스팅</Td>
                    <Td>미국 / 싱가포르</Td>
                  </tr>
                  <tr>
                    <Td>Vercel Inc.</Td>
                    <Td>웹 호스팅 및 전송</Td>
                    <Td>미국</Td>
                  </tr>
                  <tr>
                    <Td>Resend, Inc.</Td>
                    <Td>이메일 발송(확인, 재설정 등)</Td>
                    <Td>미국</Td>
                  </tr>
                  <tr>
                    <Td>Google LLC</Td>
                    <Td>OAuth 로그인, Calendar API 연동</Td>
                    <Td>미국</Td>
                  </tr>
                  <tr>
                    <Td>Apple Inc.</Td>
                    <Td>Apple 계정 로그인(Sign in with Apple)</Td>
                    <Td>미국</Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-charcoal-500">
              위 수탁자들의 처리 국가는 개별 서비스의 리전 설정에 따라 변경될 수
              있으며, 이용자는 언제든 담당자에게 위탁 내역 상세를 요청할 수
              있습니다.
            </p>
          </Section>

          <Section title="6. 이용자의 권리">
            <List>
              <li>
                이용자는 언제든 서비스의 Settings 페이지에서 본인 정보 조회·수정
                및 계정 삭제를 할 수 있습니다.
              </li>
              <li>
                개인정보 열람·정정·삭제·처리정지 요구는{" "}
                <a href="mailto:orbit42@nthing.net" className="text-navy-500 hover:underline">
                  orbit42@nthing.net
                </a>
                로 요청할 수 있으며, 회사는 관련 법령에 따라 지체 없이 조치합니다.
              </li>
              <li>
                Google 연동 해제는 Settings → Google 계정에서 가능하며,{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-navy-400 hover:underline"
                >
                  Google 계정 권한 페이지
                </a>
                에서도 해제할 수 있습니다.
              </li>
            </List>
          </Section>

          <Section title="7. 개인정보의 안전성 확보 조치">
            <List>
              <li>비밀번호는 bcrypt로 해시 저장되며 평문으로 보관되지 않습니다.</li>
              <li>통신은 HTTPS(TLS)로 암호화됩니다.</li>
              <li>데이터베이스 접근은 서비스 계정과 IP 기반으로 제한됩니다.</li>
              <li>Google OAuth 토큰은 암호화되어 저장됩니다.</li>
            </List>
          </Section>

          <Section title="8. 쿠키">
            <p>
              회사는 세션 유지, 이용자 경험 개선을 위해 쿠키를 사용합니다.
              이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이
              경우 로그인 등 일부 기능이 제한될 수 있습니다.
            </p>
          </Section>

          <Section title="9. 아동의 개인정보 보호">
            서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 만 14세 미만의
            가입이 확인될 경우 해당 계정을 즉시 삭제합니다.
          </Section>

          <Section title="10. 개인정보 보호책임자 및 연락처">
            <List>
              <li>회사명: 주식회사 엔씽 (N.THING Inc.)</li>
              <li>서비스명: 오르빗42 (orbit42) · https://orbit42.org</li>
              <li>개인정보 보호책임자: 주식회사 엔씽 대표이사</li>
              <li>
                문의:{" "}
                <a href="mailto:orbit42@nthing.net" className="text-navy-400 hover:underline">
                  orbit42@nthing.net
                </a>
              </li>
              <li>
                일반 문의:{" "}
                <a href="mailto:orbit42@nthing.net" className="text-navy-400 hover:underline">
                  orbit42@nthing.net
                </a>
              </li>
            </List>
            <p className="mt-3 text-xs text-charcoal-500">
              정부기관 신고: 개인정보침해신고센터(privacy.go.kr, 국번없이 182) /
              대검찰청 사이버수사과 / 경찰청 사이버수사국.
            </p>
          </Section>

          <Section title="11. Google 사용자 데이터의 처리 (Google User Data)">
            <p id="google-user-data">
              이용자가 Google 계정을 연결하면 서비스는 아래와 같이 Google 사용자
              데이터를 다룹니다.
            </p>
            <List>
              <li>
                <b>접근하는 데이터</b>: 로그인 시 Google 계정의 이메일·이름·프로필
                사진. Google 캘린더 연결 시(권한: calendar.calendarlist.readonly,
                calendar.events) 이용자 본인 캘린더의 목록과 일정(제목·시각·장소·참석자).
              </li>
              <li>
                <b>사용 목적</b>: 캘린더 화면에 일정을 표시하고, 다른 사람이 예약할 수
                있는 빈 시간을 계산하며, 확정된 예약을 이용자의 Google 캘린더에 일정으로
                추가·수정·삭제합니다. 이용자가 직접 켠 경우에만 일정 참석자의
                이름·이메일로 본인만 보는 관계 지도(오르빗)를 만듭니다. 그 밖의 목적
                (광고, 데이터 판매, 신용 평가, AI·머신러닝 모델 학습 등)에는 사용하지
                않습니다.
              </li>
              <li>
                <b>공유</b>: Google 사용자 데이터를 제3자에게 판매하거나 제공하지
                않습니다. 다른 이용자에게는 이용자가 공개로 정한 범위(기본값: 비어 있는
                시간만)만 보입니다. 데이터는 서비스 운영을 위한 처리 위탁사(5항의
                Supabase·Vercel)에서만 처리됩니다.
              </li>
              <li>
                <b>보호</b>: 모든 전송은 HTTPS(TLS)로 암호화되며, Google 토큰과 데이터는
                저장 시 암호화(AES-256)되는 데이터베이스에 보관되고 서버에서만
                접근할 수 있습니다.
              </li>
              <li>
                <b>보관 및 삭제</b>: Google 캘린더 일정은 서비스에 복사해 두지 않고
                화면을 볼 때마다 읽어 옵니다(관계 지도를 켠 경우의 참석자 기록은 예외이며
                기능을 끄면 즉시 삭제). 이용자가 설정에서 Google 연결을 해제하면 저장된
                토큰을 삭제하고 Google에 권한 회수를 요청하며, 회원 탈퇴 시 모든 관련
                데이터를 즉시 삭제합니다. 이용자는 Google 계정의 보안 설정
                (myaccount.google.com/permissions)에서도 언제든 권한을 회수할 수
                있습니다.
              </li>
            </List>
            <p className="mt-3 rounded-lg bg-charcoal-800/40 px-3 py-2 text-xs">
              오르빗42의 Google API에서 받은 정보의 사용 및 다른 앱으로의 전송은{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="underline"
              >
                Google API 서비스 사용자 데이터 정책
              </a>
              (제한적 사용 요건 포함)을 준수합니다.
            </p>

            <SubHead>English summary</SubHead>
            <div className="mt-2 space-y-2 text-sm leading-relaxed" lang="en">
              <p>
                <b>Data accessed.</b> With Google Sign-In: email, name and profile
                photo. When the user connects Google Calendar (scopes:
                calendar.calendarlist.readonly, calendar.events): the user&apos;s own
                calendar list and events (title, time, location, attendees).
              </p>
              <p>
                <b>Data use.</b> To display the user&apos;s events in Orbit42, compute
                free time that others can book, and create/update/delete the
                confirmed booking events on the user&apos;s Google Calendar. Only if the
                user explicitly turns it on, attendee names and emails are used to
                build a private relationship map visible only to that user. Google
                user data is not used for advertising, sale, credit decisions, or
                training AI/ML models.
              </p>
              <p>
                <b>Data sharing.</b> We do not sell or transfer Google user data to
                third parties. Other users only see what the user makes public (by
                default, free/busy time only). Data is processed only by our
                infrastructure providers (Supabase, Vercel) to operate the service.
              </p>
              <p>
                <b>Data protection.</b> All data is transmitted over HTTPS (TLS) and
                stored in databases encrypted at rest (AES-256); OAuth tokens are
                accessible only server-side.
              </p>
              <p>
                <b>Retention &amp; deletion.</b> Google Calendar events are read live
                and not stored, except attendee records for the opt-in relationship
                map, which are deleted immediately when the feature is turned off.
                Disconnecting Google in Settings deletes the stored tokens and
                revokes access with Google; deleting the account deletes all related
                data immediately. Users can also revoke access anytime at
                myaccount.google.com/permissions.
              </p>
              <p className="rounded-lg bg-charcoal-800/40 px-3 py-2 text-xs">
                Orbit42&apos;s use and transfer to any other app of information received
                from Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  className="underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </div>
          </Section>

          <Section title="12. 변경 이력">
            <List>
              <li>2026-04-15: 최초 제정</li>
              <li>
                2026-07-27: Apple 로그인 도입에 따라 수집 항목 및 처리 위탁
                내역 갱신
              </li>
              <li>
                2026-10-07: Google 사용자 데이터 처리(접근·사용·공유·보호·보관/삭제,
                제한적 사용 준수) 항목 추가, 캘린더 권한을 최소 범위로 변경
              </li>
            </List>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-charcoal-100">{title}</h2>
      <div className="text-sm leading-relaxed text-charcoal-300">{children}</div>
    </section>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 text-sm font-semibold text-charcoal-200">{children}</h3>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mt-2 list-decimal space-y-1.5 pl-5 marker:text-charcoal-500">
      {children}
    </ol>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-2 text-left text-2xs font-semibold uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-2">{children}</td>;
}
