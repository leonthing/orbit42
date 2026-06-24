import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보처리방침 · Orbit42" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-charcoal-100 hover:text-red-400"
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
          최종 업데이트: 2026년 4월 15일
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
            </List>
          </Section>

          <Section title="2. 개인정보의 이용 목적">
            <List>
              <li>회원 식별, 계정 관리, 로그인 유지</li>
              <li>서비스 제공: 캘린더 공유, 타임슬롯 등록·예약, 피드, 경매</li>
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
                <a href="mailto:orbit42@nthing.net" className="text-red-500 hover:underline">
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
                  className="text-red-500 hover:underline"
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
                <a href="mailto:orbit42@nthing.net" className="text-red-500 hover:underline">
                  orbit42@nthing.net
                </a>
              </li>
              <li>
                일반 문의:{" "}
                <a href="mailto:orbit42@nthing.net" className="text-red-500 hover:underline">
                  orbit42@nthing.net
                </a>
              </li>
            </List>
            <p className="mt-3 text-xs text-charcoal-500">
              정부기관 신고: 개인정보침해신고센터(privacy.go.kr, 국번없이 182) /
              대검찰청 사이버수사과 / 경찰청 사이버수사국.
            </p>
          </Section>

          <Section title="11. 변경 이력">
            <List>
              <li>2026-04-15: 최초 제정</li>
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
    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-2">{children}</td>;
}
