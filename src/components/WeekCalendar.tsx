"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { WeekDay, WeekItem } from "@/lib/profile-week";
import { ShareEventButton } from "@/components/ShareEventButton";
import { useSlotPanel } from "@/components/SlotPanel";
import { normalizeEventKey, toEventKey } from "@/lib/event-key";

// Visible window: 00:00 – 24:00 (full day, 24 one-hour rows).
const START_HOUR = 0;
const END_HOUR = 24;
const ROW_HEIGHT = 44; // px per hour(기본·PC) — 32 은 이벤트 두 줄이 안 들어가 뭉개졌다
const ROWS = END_HOUR - START_HOUR;
const START_MIN = START_HOUR * 60;
const END_MIN = END_HOUR * 60;

/**
 * 1시간 높이·블록 모양 — 휴대폰 하루 보기만 바꾼다(11/22 Leo "구글보다 작고 답답").
 * PC·주 보기는 기본값(44px·연한 바탕) 그대로.
 */
type Look = { hour: number; solid: boolean; bare: boolean };
const LookCtx = createContext<Look>({ hour: ROW_HEIGHT, solid: false, bare: false });
const useLook = () => useContext(LookCtx);

/** 진한 바탕 안: 캘린더 색을 흰 글자 대비 4.5 이상이 될 때까지 검정 쪽으로 섞는다 */
function solidBg(color: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return `color-mix(in srgb, ${color} 70%, #000)`;
  const n = parseInt(m[1], 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (c: number[]) => {
    const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  for (let k = 0; k <= 0.9; k += 0.05) {
    const c = rgb.map((v) => Math.round(v * (1 - k)));
    if (1.05 / (lum(c) + 0.05) >= 4.6) return `rgb(${c.join(" ")})`;
  }
  return "rgb(0 0 0)";
}

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
  /** 이동시간 막대 시작(분) — 0시 앞으로는 자른다. 막대가 없으면 startMin 과 같다 */
  travelStartMin: number;
};

export function WeekCalendar({
  username,
  days,
  emptyMessage,
  viewerIsOwner,
  completedKeys,
  ratings,
  onToggleComplete,
  onEventClick,
  onEmptyClick,
  hourPx = ROW_HEIGHT,
  solidBlocks = false,
  bare = false,
}: {
  /** 1시간 높이(px). 휴대폰 하루 보기만 크게 준다 */
  hourPx?: number;
  /** 일정 블록을 진한 단색 + 흰 글자로 */
  solidBlocks?: boolean;
  /** 카드 상자(테두리·둥근 모서리·바탕) 없이 — 휴대폰 하루 보기에서 화면 끝까지 */
  bare?: boolean;
  /** 빈 칸을 누르면 그 날짜·시각(30분 단위)으로 새 일정을 연다 */
  onEmptyClick?: (date: Date, hour: number, minute: number) => void;
  username: string;
  days: WeekDay[];
  emptyMessage?: string;
  viewerIsOwner?: boolean;
  completedKeys?: Set<string>;
  /** 만족도(하트) — toEventKey 로 찾는다. 완료한 블록에 ♥n 으로 보인다 */
  ratings?: Record<string, number>;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  const positionedByDay = useMemo(
    () => days.map((d) => position(d.items, d.date)),
    [days],
  );


  const look = useMemo(() => ({ hour: hourPx, solid: solidBlocks, bare }), [hourPx, solidBlocks, bare]);

  return (
    <LookCtx.Provider value={look}>
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${bare ? "" : "rounded-xl border border-charcoal-800/60 bg-charcoal-900/40"}`}>
      {/* 가로·세로를 한 컨테이너(UnifiedScroll)에서 스크롤한다.
          가로 스크롤을 바깥 div 로 빼면 시간축의 sticky left 가 그 스크롤포트를
          조상으로 잡지 못해 동작하지 않는다. 헤더·종일·시간표가 같은 폭을
          공유하는 것도 그대로 유지된다. */}
      <UnifiedScroll
        positionedByDay={positionedByDay}
        days={days}
        username={username}
        viewerIsOwner={viewerIsOwner}
        completedKeys={completedKeys}
        ratings={ratings}
        onToggleComplete={onToggleComplete}
        onEventClick={onEventClick}
        onEmptyClick={onEmptyClick}
      />

      {days.every((d) => d.items.length === 0) && emptyMessage && (
        // 상자 없는 휴대폰 하루 보기는 아래가 탭 막대 뒤라 안내를 위로 올린다
        <div className={`px-5 py-4 text-center text-xs text-charcoal-500 ${bare ? "order-first border-b border-charcoal-800/50 py-2" : "border-t border-charcoal-800/50"}`}>
          {emptyMessage}
        </div>
      )}
    </div>
    </LookCtx.Provider>
  );
}

function DayHeader({ day }: { day: WeekDay }) {
  const dow = day.date.toLocaleDateString("ko-KR", { weekday: "short" });
  const dateNum = day.date.getDate();
  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
  return (
    <div
      className={`snap-start border-r border-charcoal-800/40 px-2 py-2 text-center last:border-r-0 ${
        day.isToday ? "bg-navy-500/5" : ""
      }`}
    >
      <p
        className={`text-2xs font-semibold uppercase tracking-wider ${
          day.isToday ? "text-navy-400" : isWeekend ? "text-charcoal-500" : "text-charcoal-500"
        }`}
      >
        {dow}
      </p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          day.isToday
            ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy-500 text-white"
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
  const { hour: ROW_HEIGHT, bare } = useLook();
  const GRID_HEIGHT = ROWS * ROW_HEIGHT;
  return (
    <div
      // sticky 는 relative 처럼 containing block 이 되므로 시간 라벨의
      // absolute 위치 기준은 그대로 유지된다.
      className={`sticky left-0 z-10 border-r border-charcoal-800/40 ${bare ? "bg-[rgb(var(--bg-base))]" : "bg-[rgb(var(--bg-surface))]"}`}
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
            className={`absolute right-1.5 ${offsetClass} text-2xs font-medium tabular-nums text-charcoal-400`}
            style={{ top: i * ROW_HEIGHT }}
          >
            {`${String(h).padStart(2, "0")}:00`}
          </div>
        );
      })}
    </div>
  );
}

function AllDayColumn({
  items,
  viewerIsOwner,
  completedKeys,
  ratings,
  onToggleComplete,
  onEventClick,
}: {
  items: PositionedItem[];
  viewerIsOwner?: boolean;
  completedKeys?: Set<string>;
  ratings?: Record<string, number>;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  const visible = items.slice(0, 3);
  const extra = items.length - visible.length;
  return (
    <div className="min-h-[28px] space-y-1 border-r border-charcoal-800/40 px-1 py-1 last:border-r-0">
      {visible.map((item) => {
        if (item.kind === "event") {
          // 종일 일정도 iOS 하루 보기처럼 완료 체크·만족도(11/21 Leo) — 초대받은 남의 일정은 주인 몫
          const done = !!completedKeys?.has(normalizeEventKey(item.id));
          const canToggle = !!(viewerIsOwner && onToggleComplete && !item.id.startsWith("invite:"));
          return (
            <div
              key={item.id}
              className={`flex items-center gap-1 rounded-sm border-l-[3px] bg-charcoal-800/60 px-1 py-0.5 text-2xs font-medium text-charcoal-100 ${done ? "opacity-50" : ""}`}
              style={{ borderColor: item.color }}
              title={item.title}
            >
              {canToggle && (
                <CompleteBox color={item.color} completed={done} onClick={() => onToggleComplete?.(item.id)} />
              )}
              <button
                type="button"
                disabled={!onEventClick}
                onClick={() => onEventClick?.(item)}
                className={`min-w-0 flex-1 truncate text-left ${done ? "line-through" : ""}`}
              >
                {item.title}
              </button>
              <RatingMark rating={ratings?.[toEventKey(item.id)] ?? null} />
            </div>
          );
        }
        return null;
      })}
      {extra > 0 && (
        <div className="px-1 text-2xs text-charcoal-500">+{extra}</div>
      )}
    </div>
  );
}

/**
 * 블록 안 완료 체크 — iOS 하루 보기처럼 휴대폰에서도 보인다(11/21 Leo "완료한 일정에 체크 표시").
 * 휴대폰은 16px 상자 + 사방 10px 누르는 영역(36px), 데스크톱은 12px 상자 + 사방 6px.
 */
function CompleteBox({ color, checkColor, completed, onClick }: { color: string; checkColor?: string; completed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="blockCheck"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={completed ? "미완료로 표시" : "완료로 표시"}
      className="relative mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border before:absolute before:-inset-2.5 before:content-[''] md:h-3 md:w-3 md:before:-inset-1.5"
      style={{
        borderColor: color,
        backgroundColor: completed ? color : "transparent",
        color: checkColor ?? "#fff",
      }}
    >
      {completed && (
        <svg className="h-3 w-3 md:h-2.5 md:w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      )}
    </button>
  );
}

/** 매긴 만족도 — 블록 제목 오른쪽 ♥n (나만 본다) */
function RatingMark({ rating, onSolid }: { rating?: number | null; onSolid?: boolean }) {
  if (rating == null) return null;
  return (
    <span data-testid="blockRating" className={`shrink-0 text-2xs font-semibold leading-tight ${onSolid ? "text-white" : "text-pink-500"}`} aria-label={`만족도 ${rating}`}>
      ♥{rating}
    </span>
  );
}

function UnifiedScroll({
  positionedByDay,
  days,
  username,
  viewerIsOwner,
  completedKeys,
  ratings,
  onToggleComplete,
  onEventClick,
  onEmptyClick,
}: {
  onEmptyClick?: (date: Date, hour: number, minute: number) => void;
  positionedByDay: PositionedItem[][];
  days: WeekDay[];
  username: string;
  viewerIsOwner?: boolean;
  completedKeys?: Set<string>;
  /** 만족도(하트) — toEventKey 로 찾는다. 완료한 블록에 ♥n 으로 보인다 */
  ratings?: Record<string, number>;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { hour: ROW_HEIGHT, bare } = useLook();
  const GRID_HEIGHT = ROWS * ROW_HEIGHT;
  // Scroll to 06:00 on mount so the grid opens where most events live.
  // Sticky headers stay pinned; the time-grid portion scrolls beneath.
  // 휴대폰 하루 보기(상자 없음)는 iOS 와 같은 규칙으로 연다(11/22 PO): 오늘이면 지금-1시간, 다른 날은 첫 일정-1시간, 없으면 8시.
  // 처음 한 번만 — 좌우로 밀어 날짜를 넘길 때는 스크롤 위치를 그대로 둔다(넘길 때마다 튀지 않게).
  const single0 = days.length === 1;
  const anchorHour = (() => {
    if (!bare || !single0) return 8;
    const d = days[0];
    let h = 8;
    if (d?.isToday) h = new Date().getHours() - 1;
    else {
      const first = (positionedByDay[0] ?? []).filter((i) => !i.allDay).map((i) => i.startMin).sort((a, b) => a - b)[0];
      if (first != null) h = Math.floor(first / 60) - 1;
    }
    return Math.max(0, Math.min(h, 17));
  })();
  const firstDayKey = useRef(days[0]?.date.toISOString() ?? "");
  const settled = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!bare || !single0) {
      // 새벽 시간대를 보여줄 이유가 없다. 업무 시간대부터 보이게 맞춘다.
      // 08:00 라벨은 선 가운데에 걸려 있어(-translate-y-1/2) 딱 맞춰 내리면 머리줄에 반쯤 가린다 — 12px 덜 내린다(감사 7).
      el.scrollTop = 8 * ROW_HEIGHT - 12;
      return;
    }
    // 다른 날로 넘어갔으면 더는 맞추지 않는다. 같은 날이면 일정이 늦게 도착해도 한 번 더 맞춘다.
    if ((days[0]?.date.toISOString() ?? "") !== firstDayKey.current) settled.current = true;
    if (settled.current) return;
    const apply = () => { if (!settled.current) el.scrollTop = anchorHour * ROW_HEIGHT - 12; };
    apply();
    // 휴대폰 하루 보기는 칸 높이를 바깥(CalendarView)이 JS로 맞춘다 — 그 전엔 스크롤할 길이가 없어 0에 걸린다(운영 11/22 실측 00:00).
    // 칸 크기가 정해지거나 바뀌면 사람이 손대기 전까지 다시 맞춘다.
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ROW_HEIGHT, anchorHour, bare, single0]);
  // 사람이 직접 스크롤하면 그 뒤로는 손대지 않는다
  useEffect(() => {
    const el = ref.current;
    if (!el || !bare) return;
    const stop = () => { settled.current = true; };
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("wheel", stop, { passive: true });
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("wheel", stop);
    };
  }, [bare]);
  // 휴대폰(한 화면 3일): 월요일부터 열면 오늘이 화면 밖일 수 있다 → 이번 주면 오늘, 아니면 그 주 첫날로 맞춘다(웹 점검 11/20, 묶음 A).
  const weekKey = days[0]?.date.toISOString() ?? "";
  const todayIdx = days.findIndex((d) => d.isToday);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    const col = (el.scrollWidth - 44) / Math.max(days.length, 1);
    el.scrollLeft = todayIdx > 0 ? Math.round(todayIdx * col) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, todayIdx]);
  const hasAllDay = positionedByDay.some((col) => col.some((i) => i.allDay));
  const single = days.length === 1;
  const cols = single ? "grid grid-cols-[44px_minmax(0,1fr)]" : "grid grid-cols-[44px_repeat(7,minmax(0,1fr))]";
  return (
    <div
      ref={ref}
      // 모바일에서는 요일 단위로 스냅되고(scroll-pl-11 로 44px 시간축을 비켜
      // 정렬), 데스크톱은 7일이 다 들어가므로 가로 스크롤을 끈다.
      className={`min-h-0 flex-1 overflow-auto ${single ? "overflow-x-hidden" : "snap-x snap-mandatory scroll-pl-11 md:snap-none md:overflow-x-hidden"} ${bare ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] [overflow-anchor:none]" : ""}`}
    >
      {/* 모바일은 132px 고정이라 2.6일이 걸쳐 보였다. 뷰포트에서 페이지 좌우
          여백(32)·카드 테두리(2)·시간축(44)을 뺀 폭을 3으로 나눠, 한 화면에
          딱 3일이 들어오게 한다. 스냅이 요일 경계에 걸려 있어 스와이프도 맞는다.
          하루 보기(휴대폰, 묶음 B)는 하루 한 칸이 화면 폭을 다 쓴다. */}
      <div className={single ? "w-full" : "w-[calc(44px+7*((100vw-78px)/3))] sm:w-[calc(44px+7*168px)] md:w-full"}>
      {/* Sticky header stack: day labels + (optionally) all-day lane. */}
      <div className={`sticky top-0 z-20 ${bare ? "bg-[rgb(var(--bg-base))]" : "bg-[rgb(var(--bg-surface))]"}`}>
        <div className={`${cols} border-b border-charcoal-800/40 bg-charcoal-900/60 ${single ? "hidden" : ""}`}>
          <div className="sticky left-0 z-30 border-r border-charcoal-800/40 bg-[rgb(var(--bg-surface))]" />
          {days.map((day) => (
            <DayHeader key={day.date.toISOString()} day={day} />
          ))}
        </div>
        {hasAllDay && (
          <div className={`${cols} border-b border-charcoal-800/40 bg-charcoal-900/40`}>
            <div className={`sticky left-0 z-30 flex items-start justify-end border-r border-charcoal-800/40 px-1.5 pt-1.5 text-2xs font-medium text-charcoal-500 ${bare ? "bg-[rgb(var(--bg-base))]" : "bg-[rgb(var(--bg-surface))]"}`}>
              종일
            </div>
            {positionedByDay.map((items, idx) => (
              <AllDayColumn
                key={`ad-${days[idx].date.toISOString()}`}
                items={items.filter((i) => i.allDay)}
                viewerIsOwner={viewerIsOwner}
                completedKeys={completedKeys}
                ratings={ratings}
                onToggleComplete={onToggleComplete}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Time grid */}
      <div
        className={cols}
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
            ratings={ratings}
            onToggleComplete={onToggleComplete}
            onEventClick={onEventClick}
            onEmptyClick={
              onEmptyClick ? (h, m) => onEmptyClick(days[idx].date, h, m) : undefined
            }
          />
        ))}
        </div>
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
  ratings,
  onToggleComplete,
  onEventClick,
  onEmptyClick,
}: {
  onEmptyClick?: (hour: number, minute: number) => void;
  items: PositionedItem[];
  isToday: boolean;
  username: string;
  viewerIsOwner?: boolean;
  completedKeys?: Set<string>;
  /** 만족도(하트) — toEventKey 로 찾는다. 완료한 블록에 ♥n 으로 보인다 */
  ratings?: Record<string, number>;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  const { hour: ROW_HEIGHT } = useLook();
  return (
    <div
      className={`relative border-r border-charcoal-800/40 last:border-r-0 ${
        isToday ? "bg-navy-500/5" : ""
      } ${onEmptyClick ? "cursor-cell" : ""}`}
      onClick={
        onEmptyClick
          ? (e) => {
              // 일정 블록이 아니라 빈 배경을 눌렀을 때만
              if (e.target !== e.currentTarget) return;
              const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
              const totalMin = START_MIN + Math.floor((y / ROW_HEIGHT) * 2) * 30;
              onEmptyClick(Math.min(23, Math.floor(totalMin / 60)), totalMin % 60);
            }
          : undefined
      }
    >
      {/* Hour grid lines */}
      {Array.from({ length: ROWS }).map((_, i) => (
        <div
          key={`h${i}`}
          className="pointer-events-none absolute inset-x-0 border-t border-charcoal-800/50"
          style={{ top: i * ROW_HEIGHT }}
        />
      ))}
      {/* Now line */}
      {isToday && <NowLine />}

      {/* 이동시간 막대 — 일정 앞에 깔고 클릭은 통과시킨다(앱 하루 보기와 같은 규칙) */}
      {items.map((item) =>
        item.travelStartMin < item.startMin ? <TravelBand key={`t-${item.id}`} item={item} /> : null,
      )}

      {/* Items */}
      {items.map((item) => (
        <ItemBlock
          key={item.id}
          item={item}
          username={username}
          viewerIsOwner={viewerIsOwner}
          completed={!!completedKeys?.has(normalizeEventKey(item.id))}
          rating={ratings?.[toEventKey(item.id)] ?? null}
          onToggleComplete={onToggleComplete}
          onEventClick={onEventClick}
        />
      ))}
    </div>
  );
}

function NowLine() {
  const { hour } = useLook();
  const PX_PER_MIN = hour / 60;
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  if (min < START_MIN || min > END_MIN) return null;
  const top = (min - START_MIN) * PX_PER_MIN;
  return (
    <div
      data-volatile
      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-navy-400/80"
      style={{ top }}
    >
      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-navy-400" />
    </div>
  );
}

function TravelBand({ item }: { item: PositionedItem }) {
  const { hour } = useLook();
  if (item.kind !== "event") return null;
  const PX_PER_MIN = hour / 60;
  const top = (item.travelStartMin - START_MIN) * PX_PER_MIN;
  const height = (item.startMin - item.travelStartMin) * PX_PER_MIN;
  const widthPct = 100 / item.columnCount;
  const leftPct = item.column * widthPct;
  const c = item.color;
  const minutes = item.travel_min ?? 0;
  return (
    <div
      aria-hidden
      data-testid="travel-band"
      title={`이동 ${minutes}분`}
      className="pointer-events-none absolute overflow-hidden rounded-t-sm border-l-2"
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        borderColor: `color-mix(in srgb, ${c} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${c} 10%, transparent)`,
        backgroundImage: `repeating-linear-gradient(135deg, color-mix(in srgb, ${c} 22%, transparent) 0 1px, transparent 1px 6px)`,
      }}
    >
      {minutes >= 30 && height >= 16 && (
        <span
          className="block truncate px-1 text-2xs leading-[14px] opacity-80"
          style={{ color: c }}
        >
          이동 {minutes}분
        </span>
      )}
    </div>
  );
}

function ItemBlock({
  item,
  username,
  viewerIsOwner,
  completed,
  rating,
  onToggleComplete,
  onEventClick,
}: {
  item: PositionedItem;
  username: string;
  viewerIsOwner?: boolean;
  completed?: boolean;
  rating?: number | null;
  onToggleComplete?: (eventId: string) => void;
  onEventClick?: (item: WeekItem) => void;
}) {
  const panel = useSlotPanel();
  const { hour, solid, bare } = useLook();
  const PX_PER_MIN = hour / 60;
  // Clamp to visible window and translate into grid coordinates.
  const visibleStart = Math.max(item.startMin, START_MIN);
  const visibleEnd = Math.min(item.endMin, END_MIN);
  const top = (visibleStart - START_MIN) * PX_PER_MIN;
  const height = Math.max((visibleEnd - visibleStart) * PX_PER_MIN, 20);
  const widthPct = 100 / item.columnCount;
  const leftPct = item.column * widthPct;

  const style: React.CSSProperties = {
    top,
    // 상자 없는 휴대폰 하루 보기: 이어 붙은 일정(10:00–10:30, 10:30–)이 한 덩어리로 보이지 않게 1px 띄운다
    height: bare ? height - 1 : height,
    left: `calc(${leftPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  };

  if (item.kind === "event") {
    // `invite:` 는 내가 초대받은 남의 일정 — 완료 표시는 주인만 한다.
    const canToggle = !!(
      viewerIsOwner &&
      onToggleComplete &&
      !item.id.startsWith("invite:")
    );
    const clickable = !!onEventClick;
    // 진한 안(solid): 캘린더 색 단색 + 흰 글자(대비 4.5↑). 확정 대기 예약(점선)은 그대로 비운다.
    const solidFull = solid && !item.tentative;
    // 완료한 일정은 통째 반투명(대비 2.0~2.9) 대신 바탕만 30%로 흐리게, 글자는 진하게(라이트 진한 색·다크 흰 80%) — 대비 6 이상(11/22)
    const doneSolid = solidFull && !!completed;
    const solidOn = solidFull && !completed;
    const doneTx = `color-mix(in srgb, ${item.color} 62%, #000)`;
    const tint = solidOn
      ? solidBg(item.color)
      : doneSolid
        ? `color-mix(in srgb, ${solidBg(item.color)} 30%, rgb(var(--bg-base)))`
        : `color-mix(in srgb, ${item.color} 10%, transparent)`;
    const tintHover = solidOn ? tint : `color-mix(in srgb, ${item.color} 16%, transparent)`;
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
        className={`group absolute overflow-hidden px-1.5 py-0.5 transition-colors ${bare ? "rounded-md" : "rounded-sm"} ${
          item.tentative ? "border border-dashed" : solidFull ? "" : "border-l-[3px]"
        } ${clickable ? "cursor-pointer" : ""} ${completed && !doneSolid ? "opacity-50" : ""}`}
        style={{
          ...style,
          borderColor: item.color,
          backgroundColor: item.tentative ? "transparent" : tint,
        }}
        title={item.tentative ? "확정 대기 중인 예약" : undefined}
      >
        <div className="flex items-start gap-1">
          {canToggle && (
            <CompleteBox
              color={solidOn ? "#fff" : item.color}
              checkColor={solidOn ? tint : undefined}
              completed={!!completed}
              onClick={() => onToggleComplete?.(item.id)}
            />
          )}
          <p
            className={`min-w-0 flex-1 truncate font-semibold leading-tight ${bare ? "text-xs" : "text-2xs"} ${
              completed ? "line-through" : ""
            }`}
            style={solidOn ? { color: "#fff" } : doneSolid ? ({ "--done-tx": doneTx } as React.CSSProperties) : ({ "--ev": item.color } as React.CSSProperties)}
            data-ev-text={solidFull ? undefined : true}
            data-done-tx={doneSolid ? true : undefined}
          >
            {item.title}
          </p>
          <RatingMark rating={rating} onSolid={solidOn} />
        </div>
        {!item.allDay && height >= 32 && (
          <p
            className={`truncate text-2xs leading-tight ${solidFull ? "" : "dark:opacity-70"}`}
            style={solidOn ? { color: "#fff" } : doneSolid ? ({ "--done-tx": doneTx } as React.CSSProperties) : ({ "--ev": item.color } as React.CSSProperties)}
            data-ev-text={solidFull ? undefined : true}
            data-done-tx={doneSolid ? true : undefined}
          >
            {minToHM(item.startMin)}
          </p>
        )}
        {viewerIsOwner && (
          // 마우스를 올릴 때만 보이는 메뉴라 터치에서는 안 보이는데 눌리기만 했다 → 모바일에선 빼고 상세에서
          <div className="absolute right-0.5 top-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-md:hidden">
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
      ? "무료"
      : `₩${(item.price_cents / 100).toLocaleString("ko-KR")}`;
  const auctionLabel = auctionEnded
    ? "경매 종료"
    : item.auction_ends_at
      ? `경매중 · ${relativeTimeTo(item.auction_ends_at)}`
      : "경매중";
  const accent = isAuction ? "#f59e0b" : "#ef4444"; // amber-500 / navy-400
  // Slots render as outlined "empty" boxes — the empty canvas represents
  // time that isn't committed yet. On hover we nudge in a faint fill,
  // hinting at what happens when the slot gets booked.
  const tintHover = `color-mix(in srgb, ${accent} 10%, transparent)`;
  const className =
    "group absolute overflow-hidden rounded-sm border border-dashed px-1.5 py-0.5 text-left transition-colors";
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
          className="truncate text-2xs font-semibold leading-tight"
          style={{ color: accent }}
        >
          {item.title}
        </p>
        <span className="shrink-0 text-2xs font-bold" style={{ color: accent }}>
          {priceLabel}
        </span>
      </div>
      {isAuction && height >= 34 && (
        <p className="truncate text-2xs leading-tight" style={subStyle}>
          <span className="font-semibold">{auctionLabel}</span>
          {item.bid_count > 0 && <span className="ml-1">· 입찰 {item.bid_count}</span>}
        </p>
      )}
      {!isAuction && height >= 34 && (
        <p className="truncate text-2xs leading-tight" style={subStyle}>
          {minToHM(item.startMin)}–{minToHM(item.endMin)}
          {multi && <span className="ml-1 font-semibold">· {item.option_count}자리</span>}
        </p>
      )}
      {height >= 56 && (
        <p className="truncate text-2xs leading-tight" style={subStyle}>
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

/**
 * 예약 가능 시간은 한 슬롯이 시간 단위 옵션으로 쪼개져 내려온다. 그대로 그리면
 * "업무 미팅 FREE" 박스가 하루에 8개씩 쌓여 실제 일정을 덮어버린다.
 * 같은 슬롯(slot_slug)이 끊김 없이 이어지면 한 덩어리로 합쳐 그린다 — 예약은
 * 어차피 슬롯 단위로 열리므로 클릭 대상도 같다.
 *
 * 경매는 옵션마다 입찰·마감이 달라 합치지 않는다.
 */
function mergeContiguousSlots(items: WeekItem[]): WeekItem[] {
  const slots = items.filter(
    (i): i is Extract<WeekItem, { kind: "slot" }> =>
      i.kind === "slot" && i.pricing_model !== "auction",
  );
  const others = items.filter(
    (i) => !(i.kind === "slot" && i.pricing_model !== "auction"),
  );
  if (slots.length === 0) return items;

  type SlotItem = (typeof slots)[number];
  const byKey = new Map<string, SlotItem[]>();
  for (const s of slots) {
    const key = `${s.slot_slug}|${s.price_cents}`;
    const list = byKey.get(key) ?? [];
    list.push(s);
    byKey.set(key, list);
  }

  const merged: WeekItem[] = [];
  for (const list of Array.from(byKey.values())) {
    list.sort(
      (a: SlotItem, b: SlotItem) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
    let run = { ...list[0] };
    let runEnd = new Date(run.start_at).getTime() + run.duration_min * 60_000;
    for (const next of list.slice(1)) {
      const nextStart = new Date(next.start_at).getTime();
      // 1분 이내 간격이면 이어진 것으로 본다 (경계 반올림 흡수).
      if (nextStart - runEnd <= 60_000) {
        runEnd = nextStart + next.duration_min * 60_000;
        // duration_min 은 "1회 예약 길이"라 그대로 두고, 그리는 범위만 늘린다.
        // (여기서 duration_min 을 키우면 카드에 "540분" 같은 값이 찍힌다.)
        run = { ...run, end_at: new Date(runEnd).toISOString() };
      } else {
        merged.push(run);
        run = { ...next };
        runEnd = nextStart + next.duration_min * 60_000;
      }
    }
    merged.push(run);
  }
  return [...others, ...merged];
}

function position(items: WeekItem[], dayDate: Date): PositionedItem[] {
  // Compute start/end minutes within the given day.
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);

  const rough = mergeContiguousSlots(items).map((item) => {
    const s = new Date(item.start_at);
    const slotEnd =
      item.kind === "slot" && item.end_at
        ? new Date(item.end_at)
        : null;
    const e =
      item.kind === "slot"
        ? // 병합된 블록은 end_at 이 전체 구간을 가리킨다. 없거나 뒤집혀 있으면
          // 1회 예약 길이로 되돌아간다.
          slotEnd && slotEnd.getTime() > s.getTime()
          ? slotEnd
          : new Date(s.getTime() + item.duration_min * 60_000)
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
    // `all_day` 만 믿는다(iOS 하루 보기와 같은 규칙). 예전엔 시각이 붙은 문자열("…T00:00…")이면 시간표에
    // 그렸는데, Orbit 캘린더의 종일 일정은 DB 에서 늘 시각이 붙어 와 하루 종일 긴 블록으로 시간축을 덮었다(11/21).
    const allDay = item.kind === "event" && !!item.all_day;
    const travel =
      !allDay && item.kind === "event" && item.travel_min && item.travel_min > 0
        ? item.travel_min
        : 0;
    // 막대는 하루 위쪽(0시)에서 자른다. 일정이 전날부터 이어지면(startMin 0) 막대 없음
    const travelStartMin = Math.max(0, startMin - travel);
    return {
      item,
      startMin: allDay ? 0 : startMin,
      endMin: allDay ? 60 : endMin,
      allDay,
      travelStartMin: allDay ? 0 : travelStartMin,
    };
  });

  // Greedy column packing — minimizes width loss for common overlaps.
  // 겹침 배치는 이동시간까지 포함한 시작(travelStartMin)으로 — 막대가 앞 일정과 겹치지 않게
  const sorted = [...rough].sort((a, b) => a.travelStartMin - b.travelStartMin);
  const columnEnds: number[] = [];
  const withColumns = sorted.map((r) => {
    let col = columnEnds.findIndex((end) => end <= r.travelStartMin);
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
  for (const r of [...withColumns].sort((a, b) => a.travelStartMin - b.travelStartMin)) {
    if (r.travelStartMin >= currentMaxEnd && current.length) {
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
    travelStartMin: r.travelStartMin,
  })) as PositionedItem[];
}
