import Link from "next/link";
import type { WeekDay, WeekItem } from "@/lib/profile-week";
import { ShareEventButton } from "@/components/ShareEventButton";

export function WeekCalendar({
  username,
  days,
  emptyMessage,
  viewerIsOwner,
}: {
  username: string;
  days: WeekDay[];
  emptyMessage?: string;
  viewerIsOwner?: boolean;
}) {
  const totalSlots = days.reduce(
    (n, d) => n + d.items.filter((i) => i.kind === "slot").length,
    0,
  );
  const totalEvents = days.reduce(
    (n, d) => n + d.items.filter((i) => i.kind === "event").length,
    0,
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40">
      <div className="flex items-center justify-between border-b border-charcoal-800/50 px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal-500">
            This week
          </p>
          <p className="mt-0.5 text-sm font-semibold text-charcoal-200">
            {days[0]?.date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            {" – "}
            {days[6]?.date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-charcoal-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-charcoal-500" />
            일정 {totalEvents}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            예약가능 {totalSlots}
          </span>
        </div>
      </div>

      <div className="grid min-h-[18rem] grid-cols-7 divide-x divide-charcoal-800/40">
        {days.map((day) => (
          <DayColumn
            key={day.date.toISOString()}
            day={day}
            username={username}
            viewerIsOwner={viewerIsOwner}
          />
        ))}
      </div>

      {totalSlots === 0 && totalEvents === 0 && emptyMessage && (
        <div className="border-t border-charcoal-800/50 px-5 py-4 text-center text-xs text-charcoal-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function DayColumn({
  day,
  username,
  viewerIsOwner,
}: {
  day: WeekDay;
  username: string;
  viewerIsOwner?: boolean;
}) {
  const dow = day.date.toLocaleDateString("ko-KR", { weekday: "short" });
  const dateNum = day.date.getDate();
  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

  return (
    <div className={`flex flex-col ${day.isToday ? "bg-navy-600/5" : ""}`}>
      <div className="border-b border-charcoal-800/40 px-2 pb-2 pt-3 text-center">
        <p
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            day.isToday
              ? "text-navy-400"
              : isWeekend
                ? "text-charcoal-500"
                : "text-charcoal-500"
          }`}
        >
          {dow}
        </p>
        <p
          className={`mt-1 text-base font-bold ${
            day.isToday
              ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-navy-600 text-white"
              : isWeekend
                ? "text-charcoal-400"
                : "text-charcoal-100"
          }`}
        >
          {dateNum}
        </p>
      </div>

      <div className="flex-1 space-y-1.5 overflow-hidden p-1.5">
        {day.items.length === 0 && (
          <div className="mt-2 text-center text-[10px] text-charcoal-700">·</div>
        )}
        {day.items.slice(0, 6).map((item) => (
          <ItemBlock
            key={item.id}
            item={item}
            username={username}
            viewerIsOwner={viewerIsOwner}
          />
        ))}
        {day.items.length > 6 && (
          <p className="text-center text-[10px] text-charcoal-500">
            +{day.items.length - 6}
          </p>
        )}
      </div>
    </div>
  );
}

function ItemBlock({
  item,
  username,
  viewerIsOwner,
}: {
  item: WeekItem;
  username: string;
  viewerIsOwner?: boolean;
}) {
  if (item.kind === "event") {
    return (
      <div
        className="group relative rounded-md border-l-2 bg-charcoal-800/40 px-1.5 py-1"
        style={{ borderColor: item.color }}
      >
        <p className="truncate text-[10px] font-medium text-charcoal-200">
          {item.title}
        </p>
        {!item.all_day && (
          <p className="text-[9px] text-charcoal-500">
            {new Date(item.start_at).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
        {viewerIsOwner && (
          <div className="absolute right-0.5 top-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <ShareEventButton
              eventId={item.id}
              eventTitle={item.title}
              eventStart={item.start_at}
            />
          </div>
        )}
      </div>
    );
  }

  // slot
  const time = new Date(item.start_at).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Link
      href={`/${username}/s/${item.slot_slug}?t=${encodeURIComponent(item.start_at)}`}
      className="group block rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 transition-colors hover:border-amber-400 hover:bg-amber-500/20"
    >
      <div className="flex items-baseline justify-between gap-1">
        <p className="truncate text-[10px] font-semibold text-amber-200">
          {item.title}
        </p>
        <span className="shrink-0 text-[9px] font-bold text-amber-300">
          {item.price_cents === 0 ? "FREE" : `₩${(item.price_cents / 100).toLocaleString()}`}
        </span>
      </div>
      <p className="text-[9px] text-amber-300/80">
        {time} · {item.duration_min}분
      </p>
    </Link>
  );
}
