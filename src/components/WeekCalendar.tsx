"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { WeekDay, WeekItem } from "@/lib/profile-week";
import { ShareEventButton } from "@/components/ShareEventButton";
import { useSlotPanel } from "@/components/SlotPanel";
import { normalizeEventKey } from "@/lib/event-key";

// Visible window: 00:00 – 24:00 (full day, 24 one-hour rows).
const START_HOUR = 0;
const END_HOUR = 24;
const ROW_HEIGHT = 32; // px per hour
const ROWS = END_HOUR - START_HOUR; // 18
const GRID_HEIGHT = ROWS * ROW_HEIGHT; // 24 * 32 = 768
const START_MIN = START_HOUR * 60;
const END_MIN = END_HOUR * 60;
const PX_PER_MIN = ROW_HEIGHT / 60;

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
  completedKeys,
  onToggleComplete,
  onEventClick,
}: {
  username: string;
  days: WeekDay[];
  emptyMessage?: string;
  viewerIsOwner?: boolean;
  completedKeys?: Set<string>;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  const positionedByDay = useMemo(
    () => days.map((d) => position(d.items, d.date)),
    [days],
  );


  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40">
      {/* On mobile, horizontally scroll through 2-day chunks. 44px for
          the time axis + 2 day cols ≈ 360px viewport. Users swipe the
          rest. Desktop fits all 7 days naturally. */}
      <div className="overflow-x-auto md:overflow-x-visible">
        <div className="w-[calc(44px+7*132px)] sm:w-[calc(44px+7*168px)] md:w-full">
          {/* Single vertical scroll container so header, all-day and
              time grid all share the same width — no scrollbar-induced
              column drift between rows. */}
          <UnifiedScroll
            positionedByDay={positionedByDay}
            days={days}
            username={username}
            viewerIsOwner={viewerIsOwner}
            completedKeys={completedKeys}
            onToggleComplete={onToggleComplete}
            onEventClick={onEventClick}
          />
        </div>
      </div>

      {days.every((d) => d.items.length === 0) && emptyMessage && (
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
        day.isToday ? "bg-red-600/5" : ""
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          day.isToday ? "text-red-400" : isWeekend ? "text-charcoal-500" : "text-charcoal-500"
        }`}
      >
        {dow}
      </p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          day.isToday
            ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white"
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
    <div
      className="relative border-r border-charcoal-800/40"
      style={{ height: GRID_HEIGHT }}
    >
      {Array.from({ length: ROWS + 1 }).map((_, i) => {
        const h = START_HOUR + i;
        const isFirst = i === 0;
        const isLast = i === ROWS;
        // First label sits just below the top edge; last sits just above the
        // bottom edge; middle labels are centered on their gridline.
        const offsetClass = isFirst
          ? "translate-y-0"
          : isLast
            ? "-translate-y-full"
            : "-translate-y-1/2";
        return (
          <div
            key={h}
            className={`absolute right-1.5 ${offsetClass} text-[11px] font-medium tabular-nums text-charcoal-400`}
            style={{ top: i * ROW_HEIGHT }}
          >
            {`${String(h).padStart(2, "0")}:00`}
          </div>
        );
      })}
    </div>
  );
}

function AllDayColumn({ items }: { items: PositionedItem[] }) {
  const visible = items.slice(0, 3);
  const extra = items.length - visible.length;
  return (
    <div className="min-h-[28px] space-y-1 border-r border-charcoal-800/40 px-1 py-1 last:border-r-0">
      {visible.map((item) => {
        if (item.kind === "event") {
          return (
            <div
              key={item.id}
              className="truncate rounded-sm border-l-[3px] bg-charcoal-800/60 px-1 py-0.5 text-[10px] font-medium text-charcoal-100"
              style={{ borderColor: item.color }}
              title={item.title}
            >
              {item.title}
            </div>
          );
        }
        return null;
      })}
      {extra > 0 && (
        <div className="px-1 text-[10px] text-charcoal-500">+{extra}</div>
      )}
    </div>
  );
}

function UnifiedScroll({
  positionedByDay,
  days,
  username,
  viewerIsOwner,
  completedKeys,
  onToggleComplete,
  onEventClick,
}: {
  positionedByDay: PositionedItem[][];
  days: WeekDay[];
  username: string;
  viewerIsOwner?: boolean;
  completedKeys?: Set<string>;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Scroll to 06:00 on mount so the grid opens where most events live.
  // Sticky headers stay pinned; the time-grid portion scrolls beneath.
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 6 * ROW_HEIGHT;
  }, []);
  const hasAllDay = positionedByDay.some((col) => col.some((i) => i.allDay));
  return (
    <div ref={ref} className="max-h-[680px] overflow-y-auto">
      {/* Sticky header stack: day labels + (optionally) all-day lane. */}
      <div className="sticky top-0 z-20 bg-[rgb(var(--bg-surface))]">
        <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-charcoal-800/40 bg-charcoal-900/60">
          <div className="border-r border-charcoal-800/40" />
          {days.map((day) => (
            <DayHeader key={day.date.toISOString()} day={day} />
          ))}
        </div>
        {hasAllDay && (
          <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-charcoal-800/40 bg-charcoal-900/40">
            <div className="flex items-start justify-end border-r border-charcoal-800/40 px-1.5 pt-1.5 text-[10px] font-medium text-charcoal-500">
              종일
            </div>
            {positionedByDay.map((items, idx) => (
              <AllDayColumn
                key={`ad-${days[idx].date.toISOString()}`}
                items={items.filter((i) => i.allDay)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Time grid */}
      <div
        className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))]"
        style={{ height: GRID_HEIGHT }}
      >
        <TimeAxis />
        {positionedByDay.map((items, idx) => (
          <DayColumn
            key={days[idx].date.toISOString()}
            items={items.filter((i) => !i.allDay)}
            isToday={days[idx].isToday}
            username={username}
            viewerIsOwner={viewerIsOwner}
            completedKeys={completedKeys}
            onToggleComplete={onToggleComplete}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  items,
  isToday,
  username,
  viewerIsOwner,
  completedKeys,
  onToggleComplete,
  onEventClick,
}: {
  items: PositionedItem[];
  isToday: boolean;
  username: string;
  viewerIsOwner?: boolean;
  completedKeys?: Set<string>;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  return (
    <div
      className={`relative border-r border-charcoal-800/40 last:border-r-0 ${
        isToday ? "bg-red-600/5" : ""
      }`}
    >
      {/* Hour grid lines */}
      {Array.from({ length: ROWS }).map((_, i) => (
        <div
          key={`h${i}`}
          className="pointer-events-none absolute inset-x-0 border-t border-charcoal-800/50"
          style={{ top: i * ROW_HEIGHT }}
        />
      ))}
      {/* Half-hour guide (subtle) */}
      {Array.from({ length: ROWS }).map((_, i) => (
        <div
          key={`hh${i}`}
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-charcoal-800/20"
          style={{ top: i * ROW_HEIGHT + ROW_HEIGHT / 2 }}
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
          completed={!!completedKeys?.has(normalizeEventKey(item.id))}
          onToggleComplete={onToggleComplete}
          onEventClick={onEventClick}
        />
      ))}
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  if (min < START_MIN || min > END_MIN) return null;
  const top = (min - START_MIN) * PX_PER_MIN;
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
  completed,
  onToggleComplete,
  onEventClick,
}: {
  item: PositionedItem;
  username: string;
  viewerIsOwner?: boolean;
  completed?: boolean;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  const panel = useSlotPanel();
  // Clamp to visible window and translate into grid coordinates.
  const visibleStart = Math.max(item.startMin, START_MIN);
  const visibleEnd = Math.min(item.endMin, END_MIN);
  const top = (visibleStart - START_MIN) * PX_PER_MIN;
  const height = Math.max((visibleEnd - visibleStart) * PX_PER_MIN, 20);
  const widthPct = 100 / item.columnCount;
  const leftPct = item.column * widthPct;

  const style: React.CSSProperties = {
    top,
    height,
    left: `calc(${leftPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  };

  if (item.kind === "event") {
    const canToggle = !!(viewerIsOwner && onToggleComplete);
    const clickable = !!onEventClick;
    const tint = `color-mix(in srgb, ${item.color} 10%, transparent)`;
    const tintHover = `color-mix(in srgb, ${item.color} 16%, transparent)`;
    return (
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? () => onEventClick?.(item) : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEventClick?.(item);
                }
              }
            : undefined
        }
        onMouseEnter={
          clickable
            ? (e) => { e.currentTarget.style.backgroundColor = tintHover; }
            : undefined
        }
        onMouseLeave={
          clickable
            ? (e) => { e.currentTarget.style.backgroundColor = tint; }
            : undefined
        }
        className={`group absolute overflow-hidden rounded-[3px] px-1.5 py-0.5 transition-colors ${
          item.tentative ? "border border-dashed" : "border-l-[3px]"
        } ${clickable ? "cursor-pointer" : ""} ${completed ? "opacity-50" : ""}`}
        style={{
          ...style,
          borderColor: item.color,
          backgroundColor: item.tentative ? "transparent" : tint,
        }}
        title={item.tentative ? "확정 대기 중인 예약" : undefined}
      >
        <div className="flex items-start gap-1">
          {canToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete?.(item.id);
              }}
              aria-label={completed ? "미완료로 표시" : "완료로 표시"}
              className="mt-[2px] flex h-3 w-3 shrink-0 items-center justify-center rounded-[2px] border"
              style={{
                borderColor: item.color,
                backgroundColor: completed ? item.color : "transparent",
                color: "#fff",
              }}
            >
              {completed && (
                <svg
                  className="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={4}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
          )}
          <p
            className={`min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight ${
              completed ? "line-through" : ""
            }`}
            style={{ color: item.color }}
          >
            {item.title}
          </p>
        </div>
        {!item.allDay && height >= 32 && (
          <p
            className="truncate text-[10px] leading-tight opacity-70"
            style={{ color: item.color }}
          >
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

  // slot — merged bookable window
  const multi = item.option_count > 1;
  const isAuction = item.pricing_model === "auction";
  const auctionEnded =
    isAuction &&
    !!item.auction_ends_at &&
    new Date(item.auction_ends_at).getTime() <= Date.now();
  const topBid = item.current_high_bid_cents ?? item.reserve_price_cents ?? 0;
  const priceLabel = isAuction
    ? `₩${(topBid / 100).toLocaleString("ko-KR")}`
    : item.price_cents === 0
      ? "FREE"
      : `₩${(item.price_cents / 100).toLocaleString("ko-KR")}`;
  const auctionLabel = auctionEnded
    ? "경매 종료"
    : item.auction_ends_at
      ? `경매중 · ${relativeTimeTo(item.auction_ends_at)}`
      : "경매중";
  const accent = isAuction ? "#f59e0b" : "#ef4444"; // amber-500 / red-500
  // Slots render as outlined "empty" boxes — the empty canvas represents
  // time that isn't committed yet. On hover we nudge in a faint fill,
  // hinting at what happens when the slot gets booked.
  const tintHover = `color-mix(in srgb, ${accent} 10%, transparent)`;
  const className =
    "group absolute overflow-hidden rounded-[3px] border border-dashed px-1.5 py-0.5 text-left transition-colors";
  const subStyle: React.CSSProperties = { color: accent, opacity: 0.75 };
  const slotStyle: React.CSSProperties = {
    ...style,
    borderColor: accent,
    backgroundColor: "transparent",
  };
  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.backgroundColor = tintHover;
  };
  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.backgroundColor = "transparent";
  };
  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-1">
        <p
          className="truncate text-[11px] font-semibold leading-tight"
          style={{ color: accent }}
        >
          {item.title}
        </p>
        <span className="shrink-0 text-[10px] font-bold" style={{ color: accent }}>
          {priceLabel}
        </span>
      </div>
      {isAuction && height >= 34 && (
        <p className="truncate text-[10px] leading-tight" style={subStyle}>
          <span className="font-semibold">{auctionLabel}</span>
          {item.bid_count > 0 && <span className="ml-1">· 입찰 {item.bid_count}</span>}
        </p>
      )}
      {!isAuction && height >= 34 && (
        <p className="truncate text-[10px] leading-tight" style={subStyle}>
          {minToHM(item.startMin)}–{minToHM(item.endMin)}
          {multi && <span className="ml-1 font-semibold">· {item.option_count}자리</span>}
        </p>
      )}
      {height >= 56 && (
        <p className="truncate text-[10px] leading-tight" style={subStyle}>
          {item.duration_min}분
        </p>
      )}
    </>
  );
  if (panel) {
    return (
      <button
        type="button"
        onClick={() =>
          panel.open({ slug: item.slot_slug, startAt: item.start_at })
        }
        className={className}
        style={slotStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {inner}
      </button>
    );
  }
  return (
    <Link
      href={`/${username}/s/${item.slot_slug}?t=${encodeURIComponent(item.start_at)}`}
      className={className}
      style={slotStyle}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {inner}
    </Link>
  );
}

function minToHM(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function relativeTimeTo(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diff = target - now;
  if (diff <= 0) return "종료";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}분 남음`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}시간 남음`;
  const days = Math.floor(hours / 24);
  return `${days}일 남음`;
}

// ---------- Layout helpers ----------

function position(items: WeekItem[], dayDate: Date): PositionedItem[] {
  // Compute start/end minutes within the given day.
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);

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
    // Trust the upstream `all_day` flag (Google sets it when the event
    // has date-only start/end). We keep a timed-fallback guard using
    // the raw string — if it somehow contains a clock component we
    // still render it in the time grid.
    const hasTimeComponent = item.start_at.includes("T");
    const allDay =
      item.kind === "event" && !!item.all_day && !hasTimeComponent;
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
