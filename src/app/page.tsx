import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    redirect("/feed");
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600/40 to-red-500/40">
            <span className="text-sm font-bold text-charcoal-100">O</span>
          </div>
          <span className="text-base font-semibold text-charcoal-100">Orbit42</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/explore"
            className="rounded-lg px-3 py-1.5 text-sm text-charcoal-300 hover:text-charcoal-100"
          >
            Explore
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-3 py-1.5 text-sm text-charcoal-300 hover:text-charcoal-100"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-charcoal-950 hover:bg-red-400"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12 md:pt-20">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
              Time, shared and sold
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-charcoal-100 md:text-5xl lg:text-6xl">
              내 한 주가
              <br />
              <span className="bg-gradient-to-r from-red-300 to-red-500 bg-clip-text text-transparent">
                재고가 됩니다.
              </span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-charcoal-400">
              캘린더로 일상을 공유하고, 비어 있는 시간 중 일부를 슬롯으로 열어 팔거나
              나눠주세요. 누군가는 당신의 다음 화요일 3시를 기다리고 있어요.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-red-500 px-5 py-3 text-sm font-semibold text-charcoal-950 hover:bg-red-400"
              >
                Start your orbit
              </Link>
              <Link
                href="/explore"
                className="rounded-lg border border-charcoal-700 px-5 py-3 text-sm font-medium text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
              >
                Explore people
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <Pill label="Calendar" hint="공개 · 팔로워 · 비공개" />
              <Pill label="Slots" hint="무료 · 유료 · 경매" />
              <Pill label="Orbits" hint="팔로우 · 피드" />
            </div>
          </div>

          <div className="relative">
            <DemoWeekCalendar />
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-red-500/10 via-transparent to-red-600/20 blur-3xl" />
          </div>
        </div>
      </main>

      <footer className="border-t border-charcoal-800/40 px-6 py-6 text-center text-xs text-charcoal-600">
        © {new Date().getFullYear()} Orbit42
      </footer>
    </div>
  );
}

function Pill({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 px-4 py-3">
      <span className="text-sm font-semibold text-charcoal-100">{label}</span>
      <p className="mt-1 text-[11px] text-charcoal-500">{hint}</p>
    </div>
  );
}

type DemoItem =
  | { kind: "event"; title: string; time: string; color: string }
  | { kind: "slot"; title: string; time: string; price: string };

const DEMO_DAYS: { dow: string; date: number; isToday: boolean; items: DemoItem[] }[] = [
  {
    dow: "월",
    date: 14,
    isToday: false,
    items: [
      { kind: "event", title: "팀 스탠드업", time: "10:00", color: "#60a5fa" },
      { kind: "slot", title: "1:1 커피챗", time: "15:00", price: "FREE" },
    ],
  },
  {
    dow: "화",
    date: 15,
    isToday: true,
    items: [
      { kind: "event", title: "프로덕트 리뷰", time: "11:00", color: "#fb923c" },
      { kind: "slot", title: "프로덕트 멘토링", time: "14:00", price: "₩50,000" },
      { kind: "slot", title: "프로덕트 멘토링", time: "16:00", price: "₩50,000" },
    ],
  },
  {
    dow: "수",
    date: 16,
    isToday: false,
    items: [{ kind: "event", title: "헬스장", time: "07:00", color: "#a78bfa" }],
  },
  {
    dow: "목",
    date: 17,
    isToday: false,
    items: [
      { kind: "slot", title: "강북 산책 동행", time: "09:00", price: "₩20,000" },
      { kind: "event", title: "디자인 싱크", time: "14:00", color: "#60a5fa" },
    ],
  },
  {
    dow: "금",
    date: 18,
    isToday: false,
    items: [{ kind: "slot", title: "1:1 커피챗", time: "11:00", price: "FREE" }],
  },
  {
    dow: "토",
    date: 19,
    isToday: false,
    items: [{ kind: "event", title: "주말여행", time: "all", color: "#34d399" }],
  },
  {
    dow: "일",
    date: 20,
    isToday: false,
    items: [],
  },
];

function DemoWeekCalendar() {
  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40 shadow-2xl">
      <div className="flex items-center justify-between border-b border-charcoal-800/50 px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal-500">
            This week
          </p>
          <p className="mt-0.5 text-sm font-semibold text-charcoal-200">
            4월 14일 – 4월 20일
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-charcoal-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-charcoal-500" />
            일정 6
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            예약가능 5
          </span>
        </div>
      </div>

      <div className="grid min-h-[18rem] grid-cols-7 divide-x divide-charcoal-800/40">
        {DEMO_DAYS.map((day) => (
          <div
            key={day.date}
            className={`flex flex-col ${day.isToday ? "bg-red-600/5" : ""}`}
          >
            <div className="border-b border-charcoal-800/40 px-2 pb-2 pt-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
                {day.dow}
              </p>
              <p
                className={`mt-1 text-base font-bold ${
                  day.isToday
                    ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white"
                    : "text-charcoal-100"
                }`}
              >
                {day.date}
              </p>
            </div>
            <div className="flex-1 space-y-1.5 p-1.5">
              {day.items.length === 0 && (
                <div className="mt-2 text-center text-[10px] text-charcoal-700">·</div>
              )}
              {day.items.map((item, i) =>
                item.kind === "event" ? (
                  <div
                    key={i}
                    className="rounded-md border-l-2 bg-charcoal-800/40 px-1.5 py-1"
                    style={{ borderColor: item.color }}
                  >
                    <p className="truncate text-[10px] font-medium text-charcoal-200">
                      {item.title}
                    </p>
                    <p className="text-[9px] text-charcoal-500">{item.time}</p>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="rounded-md border border-red-500/40 bg-red-500/10 px-1.5 py-1"
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="truncate text-[10px] font-semibold text-red-200">
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[9px] font-bold text-red-300">
                        {item.price}
                      </span>
                    </div>
                    <p className="text-[9px] text-red-300/80">{item.time}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
