import Link from "next/link";
import type { PublicEvent } from "@/lib/public-calendar";

type Props = {
  username: string;
  events: PublicEvent[];
  /** ISO timestamp at which to consider events as "past" (server render time) */
  nowIso: string;
};

const MAX_ITEMS = 12;
const TZ = "Asia/Seoul";

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { timeZone: TZ, day: "numeric" });
  const month = d.toLocaleDateString("en-US", { timeZone: TZ, month: "short" });
  const weekday = d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
  return { day, month, weekday };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function ComingUpCard({ username, events, nowIso }: Props) {
  const now = new Date(nowIso);
  const upcoming = events
    .filter((e) => {
      const end = new Date(e.end_at || e.start_at);
      return end.getTime() > now.getTime();
    })
    .slice(0, MAX_ITEMS);

  if (upcoming.length === 0) return null;

  // Group by local-day key.
  const grouped = new Map<string, PublicEvent[]>();
  for (const e of upcoming) {
    const k = dayKey(e.start_at);
    const list = grouped.get(k) ?? [];
    list.push(e);
    grouped.set(k, list);
  }
  const dayKeys = Array.from(grouped.keys()).sort();

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="flex items-baseline justify-between border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-200">다가오는 일정</h2>
        <Link
          href={`/${username}/calendar`}
          className="text-xs text-charcoal-500 hover:text-charcoal-300"
        >
          전체 보기 →
        </Link>
      </div>
      <ul className="divide-y divide-charcoal-800/40">
        {dayKeys.map((k) => {
          const first = grouped.get(k)![0];
          const { day, month, weekday } = formatDateLabel(first.start_at);
          return (
            <li key={k} className="flex gap-4 px-5 py-3">
              <div className="flex w-14 shrink-0 flex-col leading-tight">
                <span className="text-2xl font-bold text-charcoal-100">{day}</span>
                <span className="text-xs text-charcoal-500">
                  {month} · {weekday}
                </span>
              </div>
              <ul className="min-w-0 flex-1 space-y-2">
                {grouped.get(k)!.map((e) => (
                  <li key={e.id} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: e.calendar_color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-charcoal-100">{e.title}</p>
                      <p className="text-xs text-charcoal-500">
                        {e.all_day
                          ? "하루 종일"
                          : `${formatTime(e.start_at)}${
                              e.end_at ? `~${formatTime(e.end_at)}` : ""
                            }`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
