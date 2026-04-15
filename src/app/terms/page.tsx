import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "이용약관 · Orbit42" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-500">
            <span className="text-sm font-bold text-white">O</span>
          </div>
          <span className="text-base font-semibold text-charcoal-100">Orbit42</span>
        </Link>
        <Link
          href="/privacy"
          className="text-sm text-charcoal-400 hover:text-charcoal-100"
        >
          개인정보처리방침 →
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <h1 className="text-3xl font-bold text-charcoal-100">이용약관</h1>
        <p className="mt-2 text-sm text-charcoal-500">
          최종 업데이트: 2026년 4월 15일
        </p>

        <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-charcoal-300">
          <Section title="제1조 (목적)">
            이 약관은 주식회사 엔씽(N.THING Inc., 이하 “회사”)이 제공하는
            오르빗42(orbit42, 이하 “서비스”)의 이용과 관련하여 회사와
            이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정하는
            것을 목적으로 합니다.
          </Section>

          <Section title="제2조 (정의)">
            <List>
              <li>
                <b>서비스</b>: 회사가 orbit42.org 및 관련 도메인에서 제공하는
                캘린더 공유, 타임슬롯 판매·예약, 피드, 경매 등의 기능을 의미합니다.
              </li>
              <li>
                <b>이용자</b>: 본 약관에 따라 서비스를 이용하는 회원 및 비회원을
                말합니다.
              </li>
              <li>
                <b>회원</b>: 이메일 또는 구글 계정으로 가입하여 서비스를 이용하는
                사람을 말합니다.
              </li>
              <li>
                <b>호스트</b>: 자신의 시간(타임슬롯)을 공개·판매·경매하는 회원을
                말합니다.
              </li>
              <li>
                <b>게스트</b>: 호스트의 타임슬롯을 예약하거나 입찰하는 이용자를
                말합니다.
              </li>
            </List>
          </Section>

          <Section title="제3조 (약관의 게시와 변경)">
            <List>
              <li>회사는 본 약관을 서비스 초기화면에 게시합니다.</li>
              <li>
                회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수
                있으며, 개정 시 적용일자 및 개정사유를 명시하여 현행 약관과 함께
                적용일자 7일 이전부터 공지합니다. 이용자에게 불리한 변경의 경우
                최소 30일 전에 공지합니다.
              </li>
              <li>
                이용자가 변경된 약관에 동의하지 않을 경우 이용계약을 해지할 수
                있으며, 공지 후에도 서비스를 계속 이용한 경우 변경에 동의한 것으로
                간주합니다.
              </li>
            </List>
          </Section>

          <Section title="제4조 (회원가입 및 계정)">
            <List>
              <li>
                회원은 이메일/비밀번호 또는 구글(OAuth)을 통해 가입할 수 있으며,
                가입 시 본인의 정확한 정보를 제공해야 합니다.
              </li>
              <li>
                회원은 자신의 계정과 비밀번호를 안전하게 관리할 책임이 있으며,
                제3자가 이를 이용하도록 허용해서는 안 됩니다.
              </li>
              <li>
                회원은 언제든 설정 페이지에서 계정을 삭제할 수 있으며, 삭제 시
                프로필·캘린더·타임슬롯·예약·게시글 등 관련 데이터가 즉시 비가역적으로
                삭제됩니다(법령상 보관 의무가 있는 최소 정보는 제외).
              </li>
            </List>
          </Section>

          <Section title="제5조 (서비스의 제공)">
            <List>
              <li>
                회사는 안정적인 서비스 제공을 위해 최선을 다하지만, 정기점검,
                시스템 장애, 제3자(예: Google, Supabase, Resend 등) 서비스 중단 등
                불가항력적 사유가 있는 경우 일시적으로 서비스가 중단될 수 있습니다.
              </li>
              <li>
                회사는 서비스의 일부 또는 전부를 상시·임시로 변경·추가·중단할 수
                있으며, 이 경우 사전에 합리적인 방법으로 공지합니다.
              </li>
            </List>
          </Section>

          <Section title="제6조 (타임슬롯 및 예약)">
            <List>
              <li>
                호스트는 자신이 제공할 수 있는 시간과 서비스(메뉴/스킬)를
                타임슬롯으로 등록·공개할 수 있으며, 해당 내용의 정확성과
                적법성에 대해 책임집니다.
              </li>
              <li>
                게스트는 공개된 타임슬롯을 예약하거나 경매에 입찰할 수 있으며,
                예약·입찰 내용은 호스트에게 전달됩니다.
              </li>
              <li>
                회사는 호스트와 게스트 간 거래의 통신 중개 및 기술 제공자 역할만
                수행하며, 실제 서비스 이행(시간 제공, 품질 등)은 호스트의
                책임입니다.
              </li>
              <li>
                예약 및 경매의 취소·환불은 호스트와 게스트가 직접 협의해야
                하며, 회사는 이에 개입하지 않습니다. 단, 명백한 약관 위반이
                확인된 경우 회사는 개입할 수 있습니다.
              </li>
            </List>
          </Section>

          <Section title="제7조 (결제)">
            현재 서비스는 유료 결제 기능을 단계적으로 도입 중입니다. 유료
            타임슬롯의 결제는 외부 결제대행사(예: 토스페이먼츠 등)를 통해
            이루어지며, 결제·환불 관련 세부 정책은 결제 기능 활성화 시 별도로
            고지됩니다.
          </Section>

          <Section title="제8조 (이용자의 의무 및 금지 행위)">
            이용자는 다음 행위를 해서는 안 됩니다.
            <List>
              <li>타인의 개인정보·계정·결제수단을 도용하는 행위</li>
              <li>
                음란·폭력·차별·혐오 등 공서양속에 반하거나 법령을 위반하는
                콘텐츠를 게시하거나 제공하는 행위
              </li>
              <li>
                스팸, 피싱, 사기성 거래, 불법 물품·서비스 판매 등 회사 또는
                제3자의 권리를 침해하거나 서비스 운영을 방해하는 행위
              </li>
              <li>
                서비스를 무단으로 리버스 엔지니어링·크롤링·자동화하여 상업적
                목적으로 이용하는 행위
              </li>
            </List>
          </Section>

          <Section title="제9조 (콘텐츠의 권리)">
            <List>
              <li>
                이용자가 서비스에 게시·업로드한 콘텐츠의 저작권은 이용자에게
                귀속됩니다.
              </li>
              <li>
                이용자는 회사에 대해 서비스 운영·홍보·개선을 위해 해당 콘텐츠를
                사용·복제·수정·전송·공개할 수 있는 비독점적·무상·전 세계적
                사용권을 부여합니다. 이 사용권은 이용자가 콘텐츠를 삭제하거나
                계정을 삭제한 시점부터 합리적 기간 내에 종료됩니다.
              </li>
              <li>
                회사는 본 약관, 법령 또는 공서양속에 반하는 콘텐츠를 사전
                통지 없이 비공개 처리하거나 삭제할 수 있습니다.
              </li>
            </List>
          </Section>

          <Section title="제10조 (책임의 제한)">
            <List>
              <li>
                회사는 천재지변, 제3자 서비스 장애, 해킹, 법령 개정 등
                불가항력적 사유로 인한 손해에 대해 책임지지 않습니다.
              </li>
              <li>
                회사는 호스트와 게스트 간 거래에서 발생하는 분쟁, 서비스 품질,
                예약 불이행, 손해 등에 대해 원칙적으로 책임지지 않습니다.
              </li>
              <li>
                이용자의 귀책사유(비밀번호 유출, 계정 공유 등)로 발생한 손해에
                대해 회사는 책임지지 않습니다.
              </li>
            </List>
          </Section>

          <Section title="제11조 (준거법 및 관할)">
            본 약관 및 서비스 이용과 관련한 분쟁은 대한민국 법령을 준거법으로
            하며, 분쟁에 관한 소송은 민사소송법상 관할 법원을 따릅니다.
          </Section>

          <Section title="제12조 (연락처)">
            <List>
              <li>회사명: 주식회사 엔씽 (N.THING Inc.)</li>
              <li>서비스명: 오르빗42 (orbit42)</li>
              <li>사이트: https://orbit42.org</li>
              <li>
                고객 지원: <a href="mailto:hello@orbit42.org" className="text-red-500 hover:underline">hello@orbit42.org</a>
              </li>
              <li>
                개인정보 담당:{" "}
                <a href="mailto:privacy@orbit42.org" className="text-red-500 hover:underline">privacy@orbit42.org</a>
              </li>
            </List>
          </Section>
        </div>

        <p className="mt-12 text-xs text-charcoal-500">
          이 약관은 국문을 원본으로 하며, 번역본과 원본의 의미가 다를 경우
          국문을 따릅니다.
        </p>
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
      <h2 className="mb-2 text-base font-semibold text-charcoal-100">{title}</h2>
      <div className="text-sm leading-relaxed text-charcoal-300">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mt-2 list-decimal space-y-1.5 pl-5 marker:text-charcoal-500">
      {children}
    </ol>
  );
}
