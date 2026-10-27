import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_EFFECTIVE_DATE, koDate, legalChangeState } from "@/lib/legal-change";

export const metadata: Metadata = { title: "개인정보처리방침 · Orbit42" };
// 시행일에 배포 없이 새 문장으로 바뀌도록 1시간마다 다시 그린다 (lib/legal-change)
export const revalidate = 3600;

export default function PrivacyPage() {
  const change = legalChangeState();
  const effective = change === "effective";
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
          최종 업데이트: {effective && LEGAL_EFFECTIVE_DATE ? koDate(LEGAL_EFFECTIVE_DATE) : "2026년 10월 15일"}
        </p>
        {change === "notice" && LEGAL_EFFECTIVE_DATE && (
          <div className="mt-6 rounded-xl border border-navy-400/40 bg-navy-400/10 p-4 text-sm text-charcoal-200">
            <p className="font-semibold text-charcoal-100">
              개인정보처리방침 변경 안내 — 시행일 {koDate(LEGAL_EFFECTIVE_DATE)}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-charcoal-500">
              <li>회사는 호스트와 게스트 사이의 결제를 중개하지 않아, 전자상거래법상 거래 기록을 따로 보관한다는 문장을 지웁니다.</li>
              <li>예약 기록은 호스트가 관리하는 기록으로, 호스트가 탈퇴하면 함께 파기되고 진행 전 예약의 게스트에게 취소 안내 메일을 보내 드린다는 내용을 더합니다.</li>
              <li>접속 기록(IP·기기 정보·접속 시각)은 서비스 데이터베이스에 저장하지 않고 호스팅 업체 기록에 최대 7일 남는다는 사실대로 고칩니다.</li>
              <li>예약 대화와 앱 푸시 알림을 도입하며, 수집 항목(대화 메시지, 앱 푸시용 기기 토큰)과 이용 목적, 보유 기간을 더합니다.</li>
              <li>처리 위탁 표의 업체 법인명과 국가를 실제 설정에 맞게 바로잡고, 개인정보의 국외 이전 항목을 새로 둡니다.</li>
            </ul>
            <p className="mt-2 text-xs text-charcoal-400">시행일 전까지는 아래 지금의 방침이 적용됩니다.</p>
          </div>
        )}

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
              {effective && (
                <>
                  <li>
                    예약 대화를 쓰는 경우: 예약 대화 메시지(내용·작성 시각). 계정 없이
                    예약한 분은 예약할 때 적은 이름과 함께 저장됩니다.
                  </li>
                  <li>앱 알림을 허용한 경우: 앱 푸시용 기기 토큰, 앱 버전.</li>
                </>
              )}
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
              {effective && (
                <li>예약 당사자(호스트와 게스트) 사이의 연락, 새 메시지·예약 알림 발송</li>
              )}
              <li>약관 위반 대응, 고객 문의 응대, 공지 발송</li>
              <li>법령상 의무 이행</li>
            </List>
          </Section>

          <Section title="3. 개인정보의 보유 및 이용 기간">
            <List>
              {effective ? (
                <>
                  <li>회원 정보: 회원 탈퇴 시 즉시 파기합니다.</li>
                  <li>
                    접속 기록: 접속 IP·기기 정보·접속 시각은 서비스 데이터베이스에 따로
                    저장하지 않습니다. 서비스 운영을 위해 호스팅 업체(Vercel, Supabase)의
                    접속 기록에 남으며, 업체의 보관 정책에 따라 최대 7일 뒤 자동으로
                    삭제됩니다.
                  </li>
                  <li>
                    예약 기록: 회사는 호스트와 게스트 사이의 결제를 중개하지 않습니다.
                    예약 내용과 입금 확인 상태는 호스트가 서비스 안에서 관리하는
                    기록이며, 호스트가 탈퇴하면 함께 즉시 파기됩니다. 이때 아직 진행되지
                    않은 예약이 있으면, 파기 전에 해당 게스트에게 예약 취소 안내 메일을
                    보내 드립니다.
                  </li>
                  <li>
                    회사가 직접 받는 유료 결제: 현재는 없습니다. 도입하게 되면 관련
                    법령(전자상거래법 등)에 따른 결제 기록 보관 기간을 이 방침에 추가하고,
                    시행 7일 전에 알려 드립니다.
                  </li>
                  <li>
                    예약 대화: 예약이 끝난 날로부터 1년 동안 보관한 뒤 파기합니다. 회원이
                    탈퇴하면 그 회원이 호스트나 게스트인 예약의 대화를 즉시 파기합니다.
                    계정 없이 예약한 분이 대화 삭제를 요청하시면 지체 없이
                    파기합니다(요청:{" "}
                    <a href="mailto:orbit42@nthing.net" className="text-navy-400 hover:underline">
                      orbit42@nthing.net
                    </a>
                    ).
                  </li>
                  <li>
                    신고 처리 기록: 신고된 메시지와 그 앞뒤 대화 중 신고 처리에 필요한
                    부분은 신고 처리 기록으로 남습니다. 삭제를 요청하셔도 신고 처리 기록은
                    처리일로부터 1년 보관한 뒤 삭제합니다.
                  </li>
                  <li>
                    앱 푸시 기기 토큰: 로그아웃하거나 앱을 삭제하면(전달 실패가 확인될 때),
                    또는 회원 탈퇴 시 즉시 삭제합니다.
                  </li>
                </>
              ) : (
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
              )}
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
              {effective ? (
                <li>
                  예약 발생 시 호스트와 게스트 간 상호 식별에 필요한 최소한의
                  정보(이름, 예약 메모 등)가 상대에게 전달됩니다. 예약 대화는 그 예약의
                  호스트와 게스트만 볼 수 있으며, 회사는 신고 처리를 위해 필요한 경우에만
                  확인합니다.
                </li>
              ) : (
                <li>
                  예약 발생 시 호스트와 게스트 간 상호 식별에 필요한 최소한의
                  정보(이름, 메시지 등)가 상대에게 전달됩니다.
                </li>
              )}
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
                  {(effective ? PROCESSORS_NEW : PROCESSORS_OLD).map(([who, work, country]) => (
                    <tr key={who}>
                      <Td>{who}</Td>
                      <Td>{work}</Td>
                      <Td>{country}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-charcoal-500">
              위 수탁자들의 처리 국가는 개별 서비스의 리전 설정에 따라 변경될 수
              있으며, 이용자는 언제든 담당자에게 위탁 내역 상세를 요청할 수
              있습니다.
            </p>
          </Section>

          {effective && (
            <Section title="5-1. 개인정보의 국외 이전">
              <p>
                회사는 서비스 제공을 위해 아래와 같이 개인정보를 국외로 이전합니다. 이전은
                모두 암호화된 네트워크(HTTPS/TLS)로 이루어집니다.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-charcoal-800/60 text-charcoal-400">
                      <Th>이전받는 자 (연락처)</Th>
                      <Th>이전 국가</Th>
                      <Th>이전 항목</Th>
                      <Th>이전 시점</Th>
                      <Th>이용 목적</Th>
                      <Th>보유 기간</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal-800/40 align-top text-charcoal-300">
                    {TRANSFERS.map((row) => (
                      <tr key={row[0]}>
                        {row.map((cell, i) => (
                          <Td key={i}>{cell}</Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SubHead>국외 이전을 거부하는 방법과 그 결과</SubHead>
              <List>
                <li>
                  Supabase·Vercel: 서비스 운영에 꼭 필요한 이전입니다. 거부하시려면 가입하지
                  않거나 탈퇴하셔야 하며, 이 경우 서비스를 이용할 수 없습니다.
                </li>
                <li>
                  Resend: 메일 발송에 필요합니다. 거부하시면 가입 확인·비밀번호 재설정·예약과
                  메시지 메일 알림을 받으실 수 없습니다.
                </li>
                <li>
                  Google: Google 로그인과 캘린더 연동을 쓰지 않으시면 됩니다(이메일로 가입
                  가능, 연동은 언제든 해제 가능). 이 경우 캘린더 동기화와 Google 캘린더 일정
                  등록을 쓰실 수 없습니다. 게스트로 예약하시는 경우 호스트의 Google 캘린더에
                  이름·이메일이 참석자로 들어가는 것을 원하지 않으시면 예약 전에 호스트에게
                  알려 주세요.
                </li>
                <li>
                  Apple: 앱 알림을 끄시면(앱 또는 기기 설정) 이전되지 않으며, 새 메시지는
                  메일로 알려 드립니다. Apple 로그인 대신 다른 로그인 방법을 쓰실 수 있습니다.
                </li>
              </List>
            </Section>
          )}

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
                않습니다. 이용자가 Orbit42에서 Google 캘린더 일정에 참석자를 추가하면,
                확인을 받은 뒤 그 일정에 참석자 이메일을 추가하고 Google이 참석자에게
                초대 메일을 보냅니다. 참석자 정보는 서비스에 따로 저장하지 않습니다.
                이용자가 Orbit42에서 직접 Google 캘린더 일정을 만들거나 고치거나
                지우거나 다른 캘린더로 옮기면(반복 일정의 한 회차 또는 전체 포함), 그
                요청대로 이용자의 Google 캘린더에 반영합니다. 참석자가 있는 일정의
                시간을 바꿀 때 이용자가 알림을 고르면 Google이 참석자에게 변경 메일을
                보내고, 초대받은 일정을 지우면 Google이 주최자에게 불참 응답을 보낼 수
                있습니다. 이용자가 일정에 남긴 알림·중요도·별점·다시 알림·완료
                표시·분류·수익 기록·사진 기록 등은 Google 일정 식별자와 함께 서비스에 저장됩니다.
                Google 일정의 제목·시각은 저장하지 않으며, 사진 기록을 남긴 일정은
                정렬·표시를 위해 그 날짜만 저장합니다. 이 값들은 회원 탈퇴 시 올린 파일을
                포함해 즉시 삭제되며, Google 연결을 해제해도 이용자가 다시 연결할 때를
                위해 남아 있습니다.
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
                training AI/ML models. When the user adds an attendee to a Google
                Calendar event in Orbit42 (after a confirmation step), the
                attendee&apos;s email is added to that event and Google sends them an
                invitation. Attendee data is not stored by Orbit42. When the user
                creates, edits, deletes or moves a Google Calendar event in Orbit42
                (including one occurrence or all occurrences of a recurring event),
                Orbit42 applies that change to the user&apos;s Google Calendar. If the
                user chooses to notify attendees when changing an event&apos;s time,
                Google emails the attendees; deleting an event the user was invited
                to may make Google send a decline to the organizer. Reminders,
                importance, ratings, follow-up reminders, completion marks,
                categories, earnings records, photo records and other values the
                user adds to an event are stored with the Google event ID. The
                event&apos;s title and time are not stored; for an event with a photo
                record, only its date is stored for sorting and display. These
                values, including uploaded files, are deleted immediately when the
                account is deleted; they remain after disconnecting Google so they
                reappear if the user reconnects.
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
              <li>
                2026-10-13: Google 캘린더 일정 참석자 추가(초대 메일 발송) 사용 목적
                추가
              </li>
              <li>
                2026-10-15: Google 캘린더 일정 직접 만들기·고치기·지우기·다른 캘린더로
                옮기기(반복 일정 포함), 참석자 변경 알림·불참 응답, 일정에 남긴
                알림·중요도·별점·다시 알림·완료 표시·분류·수익 기록·사진 기록의 저장
                범위(Google 일정 제목·시각은 저장하지 않음)와 삭제 시점을 사용 목적에 추가
              </li>
              {effective && LEGAL_EFFECTIVE_DATE && (
                <li>
                  {LEGAL_EFFECTIVE_DATE}: 보유 기간(접속 기록·예약 기록) 정비, 예약 대화·앱
                  푸시 알림 도입에 따른 수집 항목·이용 목적·보유 기간 추가, 처리 위탁 표
                  정정(법인명·국가), 개인정보 국외 이전 항목 신설
                </li>
              )}
            </List>
          </Section>
        </div>
      </main>
    </div>
  );
}

// 5절 처리 위탁 표: 시행일 전(옛 문장) / 시행일부터(2026-11-05 개정)
const PROCESSORS_OLD: [string, string, string][] = [
  ["Supabase, Inc.", "데이터베이스·인증·스토리지 호스팅", "미국 / 싱가포르"],
  ["Vercel Inc.", "웹 호스팅 및 전송", "미국"],
  ["Resend, Inc.", "이메일 발송(확인, 재설정 등)", "미국"],
  ["Google LLC", "OAuth 로그인, Calendar API 연동", "미국"],
  ["Apple Inc.", "Apple 계정 로그인(Sign in with Apple)", "미국"],
];
const PROCESSORS_NEW: [string, string, string][] = [
  ["Supabase Pte. Ltd.", "데이터베이스·스토리지 호스팅", "대한민국(서울 리전 저장), 운영 법인 싱가포르"],
  ["Vercel Inc.", "웹 호스팅 및 전송", "미국·대한민국"],
  ["Plus Five Five, Inc. (Resend)", "이메일 발송(확인, 재설정, 예약·메시지 알림)", "일본(발송)·미국(기록)"],
  ["Google LLC", "OAuth 로그인, Calendar API 연동", "미국"],
  ["Apple Inc.", "Apple 계정 로그인(Sign in with Apple), 앱 푸시 알림 전달(APNs)", "미국"],
];

// 5-1. 개인정보의 국외 이전 (2026-11-05 시행)
const TRANSFERS: [string, string, string, string, string, string][] = [
  [
    "Supabase Pte. Ltd. (privacy@supabase.com)",
    "대한민국(서울 리전 저장), 운영·지원 목적의 원격 접근은 싱가포르·미국",
    "회원 정보, 예약·일정 기록, 예약 대화, 앱 푸시 기기 토큰, 프로필 사진 등 서비스에 저장되는 정보 전부",
    "서비스 이용 시 수시로",
    "데이터베이스·파일 저장",
    "이 방침 3절의 기간. 업체의 기록·백업은 최대 7일",
  ],
  [
    "Vercel Inc. (privacy@vercel.com)",
    "미국, 대한민국",
    "접속 IP, 브라우저·기기 정보, 쿠키, 요청 내용",
    "서비스에 접속할 때마다",
    "웹 서비스 제공",
    "접속 기록 1일 뒤 자동 삭제",
  ],
  [
    "Plus Five Five, Inc. (Resend, support@resend.com)",
    "일본(발송), 미국(발송 기록)",
    "받는 사람 이메일, 메일 제목·내용(예약 정보, 상대 이름 등. 새 메시지 알림 메일에는 메시지 내용을 담지 않음)",
    "메일을 보낼 때마다",
    "이메일 발송",
    "30일 뒤 삭제",
  ],
  [
    "Google LLC (Google 개인정보 문의 창구)",
    "미국 등 Google 서버 소재 국가",
    "Google 로그인·캘린더 연동 시: 이메일, 일정 정보. 예약 시 호스트의 Google 캘린더 일정에 들어가는 게스트 이름·이메일",
    "Google 로그인·캘린더 연동, 일정 조회·변경, 예약 확정 시",
    "로그인, 캘린더 연동",
    "Google 정책에 따름. 예약으로 만든 일정은 호스트의 캘린더에 남음",
  ],
  [
    "Apple Inc. (privacyoffice_korea@apple.com)",
    "미국",
    "앱 푸시 기기 토큰, 알림 문구(“새 메시지가 있어요” — 보낸 사람·메시지 내용은 담지 않음)",
    "알림을 보낼 때마다",
    "앱 푸시 알림 전달",
    "전달 목적을 달성할 때까지(Apple 정책)",
  ],
];

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
