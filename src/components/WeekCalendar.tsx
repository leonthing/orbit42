"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { WeekDay, WeekItem } from "@/lib/profile-week";
import { ShareEventButton } from "@/components/ShareEventButton";

// Half-hour row height (px). 48 rows × 24px = 1152px total — scrollable.
const ROW_HEIGHT = 24;
const ROWS = 48; // 24h × 2
const GRID_HEIGHT = ROWS * ROW_HEIGHT;

type PositionedItem = WeekItem & {
  /** Minutes from midnight (clamped to [0, 1440]). */
  startMin: number;
  /** Minutes from midnight (clamped to (startMin, 1440]). */
  endMin: number;
  /** Column index within overlapping cluster. */
  column: number;
  /** Total columns in the cluster this item belongs to. */
  columnCount: number;
  /** True when item extends across midnight on its own day. */
  allDay: boolean;
};

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

  const positionedByDay = useMemo(
    () => days.map((d) => position(d.items, d.date)),
    [days],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll to first item's hour if any, else 8:00.
    const firstMin = positionedByDay
      .flatMap((d) => d)
      .filter((i) => !i.allDay)
      .map((i) => i.startMin)
      .sort((a, b) => a - b)[0];
    const target = firstMin !== undefined ? Math.max(firstMin - 60, 0) : 8 * 60;
    const y = (target / 30) * ROW_HEIGHT;
    scrollRef.current?.scrollTo({ top: y });
  }, [positionedByDay]);

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

      {/* Day headers (sticky) */}
      <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b border-charcoal-800/40 bg-charcoal-900/30">
        <div className="border-r border-charcoal-800/40" />
        {days.map((day) => (
          <DayHeader key={day.date.toISOString()} day={day} />
        ))}
      </div>

      {/* Scrollable time grid */}
      <div
        ref={scrollRef}
        className="relative max-h-[560px] overflow-y-auto"
      >
        <div
          className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))]"
          style={{ height: GRID_HEIGHT }}
        >
          {/* Time axis */}
          <TimeAxis />
          {positionedByDay.map((items, idx) => (
            <DayColumn
              key={days[idx].date.toISOString()}
              items={items}
              isToday={days[idx].isToday}
              username={username}
              viewerIsOwner={viewerIsOwner}
            />
          ))}
        </div>
      </div>

      {totalSlots === 0 && totalEvents === 0 && emptyMessage && (
        <div className="border-t border-charcoal-800/50 px-5 py-4 text-center text-xs text-charcoal-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function DayHeader({ day }: { day: WeekDay }) {
  const dow = day.date.toLocaleDateString("ko-KR", { weekday: "short" });
  const dateNum = day.date.getDate();
  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
  return (
    <div
      className={`border-r border-charcoal-800/40 px-2 py-2 text-center last:border-r-0 ${
        day.isToday ? "bg-navy-600/5" : ""
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          day.isToday ? "text-navy-400" : isWeekend ? "text-charcoal-500" : "text-charcoal-500"
        }`}
      >
        {dow}
      </p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          day.isToday
            ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy-600 text-white"
            : isWeekend
              ? "text-charcoal-400"
              : "text-charcoal-100"
        }`}
      >
        {dateNum}
      </p>
    </div>
  );
}

function TimeAxis() {
  return (
    <div className="relative border-r border-charcoal-800/40" style={{ height: GRID_HEIGHT }}>
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={h}
          className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-charcoal-500"
          style={{ top: h * 2 * ROW_HEIGHT }}
        >
          {h === 0 ? "" : String(h).padStart(2, "0")}
        </div>
      ))}
    </div>
  );
}

function DayColumn({
  items,
  isToday,
  username,
  viewerIsOwner,
}: {
  items: PositionedItem[];
  isToday: boolean;
  username: string;
  viewerIsOwner?: boolean;
}) {
  return (
    <div
      className={`relative border-r border-charcoal-800/40 last:border-r-0 ${
        isToday ? "bg-navy-600/5" : ""
      }`}
    >
      {/* Hour grid lines */}
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={`h${h}`}
          className="pointer-events-none absolute inset-x-0 border-t border-charcoal-800/40"
          style={{ top: h * 2 * ROW_HEIGHT }}
        />
      ))}
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={`hh${h}`}
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-charcoal-800/20"
          style={{ top: h * 2 * ROW_HEIGHT + ROW_HEIGHT }}
        />
      ))}

      {/* Now line */}
      {isToday && <NowLine />}

      {/* Items */}
      {items.map((item) => (
        <ItemBlock
          key={item.id}
          item={item}
          username={username}
          viewerIsOwner={viewerIsOwner}
        />
      ))}
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const top = (min / 30) * ROW_HEIGHT;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-400/80"
      style={{ top }}
    >
      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-400" />
    </div>
  );
}

function ItemBlock({
  item,
  username,
  viewerIsOwner,
}: {
  item: PositionedItem;
  username: string;
  viewerIsOwner?: boolean;
}) {
  const top = (item.startMin / 30) * ROW_HEIGHT;
  const height = Math.max(((item.endMin - item.startMin) / 30) * ROW_HEIGHT, 20);
  const widthPct = 100 / item.columnCount;
  const leftPct = item.column * widthPct;

  const style: React.CSSProperties = {
    top,
    height,
    left: `calc(${leftPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  };

  if (item.kind === "event") {
    return (
      <div
        className="group absolute overflow-hidden rounded-md border-l-2 bg-charcoal-800/60 px-1.5 py-0.5 shadow-sm"
        style={{ ...style, borderColor: item.color }}
      >
        <p className="truncate text-[10px] font-semibold text-charcoal-100">
          {item.title}
        </p>
        {!item.allDay && (
          <p className="truncate text-[9px] text-charcoal-400">
            {minToHM(item.startMin)}
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
  return (
    <Link
      href={`/${username}/s/${item.slot_slug}?t=${encodeURIComponent(item.start_at)}`}
      className="group absolute overflow-hidden rounded-md border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 transition-colors hover:border-amber-400 hover:bg-amber-500/30"
      style={style}
    >
      <p className="truncate text-[10px] font-semibold text-amber-100">
        {item.title}
      </p>
      <p className="truncate text-[9px] text-amber-200/80">
        {minToHM(item.startMin)} · {item.duration_min}분 ·{" "}
        {item.price_cents === 0
          ? "FREE"
          : `₩${(item.price_cents / 100).toLocaleString("ko-KR")}`}
      </p>
    </Link>
  );
}

function minToHM(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ---------- Layout helpers ----------

function position(items: WeekItem[], dayDate: Date): PositionedItem[] {
  // Compute start/end minutes within the given day.
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  const rough = items.map((item) => {
    const s = new Date(item.start_at);
    const e =
      item.kind === "slot"
        ? new Date(
            new Date(item.start_at).getTime() + item.duration_min * 60_000,
          )
        : new Date(item.end_at || item.start_at);
    const startMin = Math.max(
      0,
      Math.round((s.getTime() - dayStart.getTime()) / 60_000),
    );
    const endMin = Math.min(
      1440,
      Math.max(
        startMin + 30,
        Math.round((e.getTime() - dayStart.getTime()) / 60_000),
      ),
    );
    const allDay =
      item.kind === "event" && item.all_day && s <= dayStart && e >= dayEnd;
    return { item, startMin: allDay ? 0 : startMin, endMin: allDay ? 60 : endMin, allDay };
  });

  // Greedy column packing — minimizes width loss for common overlaps.
  const sorted = [...rough].sort((a, b) => a.startMin - b.startMin);
  const columnEnds: number[] = [];
  const withColumns = sorted.map((r) => {
    let col = columnEnds.findIndex((end) => end <= r.startMin);
    if (col === -1) {
      columnEnds.push(r.endMin);
      col = columnEnds.length - 1;
    } else {
      columnEnds[col] = r.endMin;
    }
    return { ...r, column: col };
  });

  // Group into clusters to find columnCount per item.
  const clusters: typeof withColumns[] = [];
  let current: typeof withColumns = [];
  let currentMaxEnd = -Infinity;
  for (const r of [...withColumns].sort((a, b) => a.startMin - b.startMin)) {
    if (r.startMin >= currentMaxEnd && current.length) {
      clusters.push(current);
      current = [];
      currentMaxEnd = -Infinity;
    }
    current.push(r);
    currentMaxEnd = Math.max(currentMaxEnd, r.endMin);
  }
  if (current.length) clusters.push(current);

  const colCountFor = new Map<string, number>();
  for (const cluster of clusters) {
    const count = cluster.reduce((m, r) => Math.max(m, r.column + 1), 0);
    for (const r of cluster) colCountFor.set(r.item.id, count);
  }

  return withColumns.map((r) => ({
    ...r.item,
    startMin: r.startMin,
    endMin: r.endMin,
    column: r.column,
    columnCount: colCountFor.get(r.item.id) ?? 1,
    allDay: r.allDay,
  })) as PositionedItem[];
}
