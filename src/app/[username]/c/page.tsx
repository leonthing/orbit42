import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import { getPublicEvents } from "@/lib/public-calendar";
import { getReactionsForMany } from "@/lib/reactions";
import { ReactionStrip } from "@/components/ReactionStrip";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getProfile(params.username);
  if (!profile) return { title: "Calendar" };
  return { title: `${profile.display_name || profile.username}'s calendar` };
}

export default async function PublicCalendarPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { m?: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  // Month navigation: m=YYYY-MM
  const now = new Date();
  const { year, month } = parseMonthParam(searchParams.m, now);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  const [events, session] = await Promise.all([
    getPublicEvents(params.username, monthStart, monthEnd),
    getSession(),
  ]);
  const reactions = await getReactionsForMany(
    "event",
    events.map((e) => e.id),
  );

  const prev = monthShift(year, month, -1);
  const next = monthShift(year, month, 1);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link
            href={`/${params.username}`}
            className="text-xs text-charcoal-500 hover:text-charcoal-300"
          >
            ← {profile.display_name || profile.username}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-charcoal-100">
            {monthStart.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long" })}
          </h1>
        </div>
        <div className="flex gap-1">
          <Link
            href={`/${params.username}/c?m=${prev.year}-${String(prev.month + 1).padStart(2, "0")}`}
            className="rounded-md border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-300 hover:border-charcoal-600"
          >
            ‹
          </Link>
          <Link
            href={`/${params.username}/c`}
            className="rounded-md border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-300 hover:border-charcoal-600"
          >
            오늘
          </Link>
          <Link
            href={`/${params.username}/c?m=${next.year}-${String(next.month + 1).padStart(2, "0")}`}
            className="rounded-md border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-300 hover:border-charcoal-600"
          >
            ›
          </Link>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-charcoal-800/60 p-10 text-center">
          <p className="text-sm font-semibold text-charcoal-200">
            공개된 일정이 없어요
          </p>
          <p className="mt-2 text-sm text-charcoal-500">
            호스트가 캘린더를 공개하면 여기에 보입니다.
          </p>
        </div>
      ) : (
        <Agenda events={events} reactions={reactions} loggedIn={!!session} />
      )}
    </div>
  );
}

function Agenda({
  events,
  reactions,
  loggedIn,
}: {
  events: Awaited<ReturnType<typeof getPublicEvents>>;
  reactions: Map<string, import("@/lib/reactions-types").ReactionSummary[]>;
  loggedIn: boolean;
}) {
  // Group by date string
  const groups: Record<string, typeof events> = {};
  for (const e of events) {
    const key = new Date(e.start_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    (groups[key] ||= []).push(e);
  }

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([day, evs]) => (
        <section key={day}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal-500">
            {day}
          </h2>
          <ul className="space-y-1.5">
            {evs.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-charcoal-800/40 bg-charcoal-900/30 p-3"
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: e.calendar_color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-charcoal-100">
                    {e.title}
                  </p>
                  <p className="mt-0.5 text-xs text-charcoal-500">
                    {e.all_day
                      ? "하루 종일"
                      : `${new Date(e.start_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul",
                          hour: "2-digit",
                          minute: "2-digit",
                        })} – ${new Date(e.end_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                    <span className="ml-2 text-charcoal-600">· {e.calendar_label}</span>
                  </p>
                  <div className="mt-2">
                    <ReactionStrip
                      target_type={"event" as const}
                      target_id={e.id}
                      initial={reactions.get(e.id) ?? []}
                      loggedIn={loggedIn}
                      size="sm"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function parseMonthParam(m: string | undefined, fallback: Date) {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y, month: mo - 1 };
  }
  return { year: fallback.getFullYear(), month: fallback.getMonth() };
}

function monthShift(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
