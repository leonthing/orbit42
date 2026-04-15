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
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-500">
            <span className="text-sm font-bold text-white">O</span>
          </div>
          <span className="text-base font-semibold text-charcoal-100">Orbit42</span>
        </Link>
<span />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:px-10 md:pt-16 lg:pt-20">
        <section className="flex flex-col gap-8 md:grid md:grid-cols-2 md:items-start md:gap-12">
          <div className="order-1 min-w-0 md:col-start-1 md:row-start-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-700 dark:text-red-400">
              Time, shared and sold
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-[1.15] tracking-tight text-charcoal-100 sm:text-4xl md:text-5xl lg:text-6xl">
              시간은 가장 중요한
              <br />
              <span className="bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent">
                자산입니다.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-charcoal-400 sm:text-base">
              캘린더로 일상을 공유하고, 비어있는 시간을 슬롯으로
              판매하여 수익을 창출하세요.
            </p>

            <div className="mt-7 flex justify-center md:justify-start">
              <Link
                href="/explore"
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-red-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-500 hover:shadow-red-500/30 sm:w-auto md:py-3 md:text-sm"
              >
                <svg
                  className="h-5 w-5 md:h-4 md:w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
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

        <section className="mt-16 md:mt-24">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-charcoal-500">
              이런 모습이에요
            </h2>
            <span className="text-xs text-charcoal-600">예시</span>
          </div>
          <DemoCalendar />
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3 md:mt-24">
          <ValueCard
            title="캘린더로 존재감"
            body="비어 있는 시간을 공개하면 내가 어디에 있는지, 누구에게 시간을 쓰는지가 드러나요."
          />
          <ValueCard
            title="시간에 가격표"
            body="무료 커피챗도, ₩50,000 멘토링도, 경매로 열리는 저녁도 같은 캘린더 안에 있어요."
          />
          <ValueCard
            title="내 궤도의 사람들"
            body="팔로워가 아니라 'orbiters'. 내 주변을 도는 사람들과 자연스럽게 거래가 시작돼요."
          />
        </section>
      </main>

      <footer className="border-t border-charcoal-800/40 px-4 py-6 text-center text-xs text-charcoal-500 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>© {new Date().getFullYear()} 주식회사 엔씽 (N.THING Inc.)</span>
          <span className="hidden text-charcoal-700 sm:inline">·</span>
          <Link href="/terms" className="hover:text-charcoal-300">
            이용약관
          </Link>
          <span className="text-charcoal-700">·</span>
          <Link href="/privacy" className="hover:text-charcoal-300">
            개인정보처리방침
          </Link>
          <span className="text-charcoal-700">·</span>
          <a
            href="mailto:hello@orbit42.org"
            className="hover:text-charcoal-300"
          >
            hello@orbit42.org
          </a>
        </div>
      </footer>
    </div>
  );
}

function ValueCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <p className="text-sm font-semibold text-charcoal-100">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-charcoal-400">{body}</p>
    </div>
  );
}

type DemoItem =
  | { kind: "event"; title: string; time: string; color: string }
  | { kind: "slot"; title: string; time: string; price: string; auction?: boolean };

const DEMO_ITEMS: DemoItem[] = [
  { kind: "event", title: "팀 스탠드업", time: "월 10:00", color: "#60a5fa" },
  { kind: "slot", title: "프로덕트 멘토링", time: "화 14:00", price: "₩50,000" },
  { kind: "slot", title: "1:1 커피챗", time: "금 11:00", price: "FREE" },
  {
    kind: "slot",
    title: "주말 점심식사",
    time: "토 12:00",
    price: "₩32,000",
    auction: true,
  },
  { kind: "event", title: "디자인 싱크", time: "목 14:00", color: "#a78bfa" },
];

function DemoCalendar() {
  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40 shadow-2xl">
      <div className="flex items-center justify-between border-b border-charcoal-800/50 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal-500">
            This week
          </p>
          <p className="mt-0.5 text-sm font-semibold text-charcoal-200">
            4월 14일 – 4월 20일
          </p>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-charcoal-500 sm:gap-3 sm:text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-charcoal-500" />
            일정 2
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            슬롯 3
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
    </div>
  );
}
