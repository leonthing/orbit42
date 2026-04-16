import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    redirect("/feed");
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-10 md:py-5">
        <Link href="/" className="text-base font-semibold tracking-tight text-charcoal-100">
          Orbit42
        </Link>
        <span />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:px-10 md:pt-16 lg:pt-20">
        {/* Hero */}
        <section className="flex flex-col gap-8 md:grid md:grid-cols-2 md:items-start md:gap-12">
          <div className="order-1 min-w-0 md:col-start-1 md:row-start-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-700 dark:text-red-400">
              Book time, not tables
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-[1.15] tracking-tight text-charcoal-100 sm:text-4xl md:text-5xl lg:text-[56px]">
              미팅 일정을
              <br />
              <span className="bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent">
                맛집 예약처럼
              </span>
              <br />
              간편하게
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-charcoal-400 sm:text-base">
              링크 하나로 상대가 내 남는 시간을 예약해요.
              <br />
              “언제 괜찮으세요?” 이메일 핑퐁은 이제 그만.
            </p>

            <div className="mt-7 flex justify-center md:justify-start">
              <Link
                href="/explore"
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-red-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-500 hover:shadow-red-500/30 sm:w-auto md:py-3 md:text-sm"
              >
                <svg className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                활동 중인 사람들 둘러보기
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
          </div>

          <div className="relative order-2 min-w-0 md:col-start-2 md:row-span-2 md:row-start-1">
            <AuthCard initialMode="signup" />
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-red-500/10 via-transparent to-red-600/20 blur-3xl" />
          </div>
        </section>

        {/* Feature 1: Easy meeting booking */}
        <section className="mt-20 md:mt-28">
          <FeatureHeader
            eyebrow="1분이면 돼요"
            title="미팅 예약, 더 쉬울 수가 없어요"
            body="슬롯을 열고 링크를 보내면, 상대는 이름과 이메일만 남기고 바로 예약 완료. 가입도, 로그인도 필요 없어요."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2 md:items-start">
            <div className="space-y-3">
              <Step
                n={1}
                title="슬롯 열기"
                body="요일 · 시간대 · 가격을 정해 슬롯을 만들어요. 30초면 충분해요."
              />
              <Step
                n={2}
                title="링크 공유"
                body="예약 페이지 URL을 카톡/이메일로 전송. 미리보기까지 예쁘게 떠요."
              />
              <Step
                n={3}
                title="자동 확정"
                body="상대가 시간을 고르면 양쪽에 알림 + 캘린더에 자동 등록돼요."
              />
            </div>
            <DemoBookingPage />
          </div>
        </section>

        {/* Feature 2: Monetize free time */}
        <section className="mt-20 md:mt-28">
          <FeatureHeader
            eyebrow="Google Calendar 연동"
            title="남는 시간을 수익으로"
            body="구글 캘린더의 빈 시간을 자동으로 읽어서, 그 안에서만 예약 가능하게 만들어줘요. 이미 일정 있는 시간은 자동으로 제외."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <ValueCard
              title="자동 가용시간"
              body="근무 시간만 정하면 Google Calendar를 보고 알아서 빈 시간을 뽑아줘요. 수동으로 하나씩 열 필요 없음."
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              }
            />
            <ValueCard
              title="무료부터 경매까지"
              body="0원 커피챗, 5만원 멘토링, 그리고 경매로 열리는 프리미엄 저녁. 같은 캘린더 안에서 자유롭게."
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              }
            />
          </div>
          <DemoCalendar />
        </section>

        {/* Feature 3: Orbits (community) */}
        <section className="mt-20 md:mt-28">
          <FeatureHeader
            eyebrow="Orbit"
            title="다양한 궤도의 사람들과 만나요"
            body="팔로워가 아니라 'orbiters' — 내 주변을 도는 사람들. 창업가, 디자이너, 개발자, 크리에이터 — 서로 다른 궤도가 교차할 때 재밌는 일이 생겨요."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <ValueCard
              title="Explore"
              body="지금 활동 중인 사람들을 둘러보고, 관심 있는 사람의 시간을 예약해요."
            />
            <ValueCard
              title="Feed"
              body="내가 팔로우하는 사람들이 오늘 무엇을 하는지 타임라인으로 흐르듯 보여요."
            />
            <ValueCard
              title="Messages"
              body="슬롯 예약 전에 1:1로 가볍게 이야기를 먼저 나눠볼 수 있어요."
            />
          </div>
        </section>

        {/* CTA bottom */}
        <section className="mt-20 overflow-hidden rounded-3xl border border-charcoal-800/60 bg-gradient-to-br from-red-600/15 via-charcoal-900/60 to-charcoal-900/30 p-6 text-center sm:p-8 md:mt-28 md:p-12">
          <h2 className="text-xl font-bold leading-tight text-charcoal-100 sm:text-2xl md:text-3xl">
            시간은 가장 중요한 자산입니다
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-charcoal-400">
            지금 초대 기반으로 운영 중이에요. 초대 코드가 있다면 위 가입
            화면에, 없다면 지인에게 물어보세요.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
          >
            먼저 구경해볼게요
            <span>→</span>
          </Link>
        </section>
      </main>

      <footer className="border-t border-charcoal-800/40 px-4 py-6 text-center text-xs text-charcoal-500 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>© {new Date().getFullYear()} N.THING Inc.</span>
          <span className="hidden text-charcoal-700 sm:inline">·</span>
          <Link href="/terms" className="hover:text-charcoal-300">
            이용약관
          </Link>
          <span className="text-charcoal-700">·</span>
          <Link href="/privacy" className="hover:text-charcoal-300">
            개인정보처리방침
          </Link>
        </div>
      </footer>
    </div>
  );
}

function FeatureHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-700 dark:text-red-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-charcoal-100 sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-charcoal-400 sm:text-base">
        {body}
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="relative rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
        {n}
      </div>
      <p className="mt-3 text-sm font-semibold text-charcoal-100">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-charcoal-400">{body}</p>
    </div>
  );
}

function ValueCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      {icon && (
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/15 text-red-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-charcoal-100">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-charcoal-400">{body}</p>
    </div>
  );
}

type DemoItem =
  | { kind: "event"; title: string; time: string; color: string }
  | { kind: "slot"; title: string; time: string; price: string; auction?: boolean };

const DEMO_ITEMS: DemoItem[] = [
  { kind: "event", title: "팀 스탠드업 (Google Calendar)", time: "월 10:00", color: "#60a5fa" },
  { kind: "slot", title: "프로덕트 멘토링", time: "화 14:00", price: "₩50,000" },
  { kind: "slot", title: "1:1 커피챗", time: "금 11:00", price: "FREE" },
  { kind: "slot", title: "주말 점심식사", time: "토 12:00", price: "₩32,000", auction: true },
  { kind: "event", title: "디자인 싱크 (Google Calendar)", time: "목 14:00", color: "#a78bfa" },
];

function DemoBookingPage() {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  // Hardcoded demo: April 2026 starts on a Wednesday.
  const firstDow = 3;
  const daysInMonth = 30;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const bookable = new Set([16, 17, 20, 21, 22, 23, 24, 27, 28, 29, 30]);
  const today = 17;
  const selected = 21;
  const times = ["10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40 shadow-2xl">
      <div className="border-b border-charcoal-800/50 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-charcoal-500">
          예약 페이지 예시
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="text-base font-bold text-charcoal-100">
            프로덕트 멘토링
          </h3>
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
            ₩50,000
          </span>
        </div>
        <p className="mt-1 text-xs text-charcoal-500">
          60분 · @leokim5854
        </p>
      </div>

      <div className="p-5">
        <p className="mb-3 text-xs font-semibold text-charcoal-200">
          예약 가능한 시간
        </p>

        {/* Mini calendar */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-charcoal-300">2026년 4월</p>
            <div className="flex gap-1">
              <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-charcoal-500">‹</span>
              <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-charcoal-500">›</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-semibold uppercase tracking-wider text-charcoal-500">
            {weekdays.map((w, i) => (
              <span
                key={w}
                className={i === 0 ? "text-red-500/70" : i === 6 ? "text-blue-400/70" : ""}
              >
                {w}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />;
              const has = bookable.has(d);
              const isSelected = d === selected;
              const isToday = d === today;
              return (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-md text-xs ${
                    isSelected
                      ? "bg-red-600 font-bold text-white"
                      : isToday
                        ? "ring-1 ring-red-500/60 text-charcoal-200"
                        : has
                          ? "text-charcoal-100"
                          : "text-charcoal-600"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span>{d}</span>
                    {has && !isSelected && (
                      <span className="mt-0.5 h-1 w-1 rounded-full bg-red-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Time pills */}
        <p className="mb-2 text-[11px] font-medium text-charcoal-500">오전 · 오후</p>
        <div className="grid grid-cols-3 gap-1.5">
          {times.map((t, i) => (
            <div
              key={t}
              className={`rounded-md border px-2 py-1.5 text-center text-xs tabular-nums ${
                i === 2
                  ? "border-red-500 bg-red-600/15 font-semibold text-charcoal-100"
                  : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-200"
              }`}
            >
              {t}
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled
          className="mt-4 w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white"
        >
          ₩50,000 · 예약 진행
        </button>
      </div>
    </div>
  );
}

function DemoCalendar() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40 shadow-2xl">
      <div className="flex items-center justify-between border-b border-charcoal-800/50 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal-500">
            This week
          </p>
          <p className="mt-0.5 text-sm font-semibold text-charcoal-200">
            내 캘린더 (예시)
          </p>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-charcoal-500 sm:gap-3 sm:text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-charcoal-500" />
            일정 2
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            예약가능 3
          </span>
        </div>
      </div>

      <ul className="divide-y divide-charcoal-800/40">
        {DEMO_ITEMS.map((item, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            {item.kind === "event" ? (
              <span
                aria-hidden
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            ) : (
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                  item.auction
                    ? "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-200 dark:ring-0"
                    : "bg-red-500/15 text-red-800 ring-1 ring-red-500/30 dark:text-red-200 dark:ring-0"
                }`}
              >
                {item.auction ? "경매" : "슬롯"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-charcoal-100">
                {item.title}
              </p>
              <p className="text-[11px] text-charcoal-500">{item.time}</p>
            </div>
            {item.kind === "slot" && (
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${
                  item.auction
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                    : "bg-red-500/15 text-red-800 dark:text-red-200"
                }`}
              >
                {item.price}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-charcoal-800/40 bg-charcoal-900/50 px-4 py-2.5 text-[11px] text-charcoal-500 sm:px-5">
        Google 일정은 자동으로 읽어와 예약 가능 시간에서 제외돼요
      </div>
    </div>
  );
}
