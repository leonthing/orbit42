"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getEvents } from "@/app/[username]/calendar/actions";

const DAYS_MON = ["월", "화", "수", "목", "금", "토", "일"];
const DAYS_SUN_FIRST = ["일", "월", "화", "수", "목", "금", "토"];
const STORAGE_KEY = "orbit42.miniMonth.collapsed";

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function ymd(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function MiniMonth({ username }: { username: string }) {
  // "Today" must come from the browser clock, never the SSR pass — the
  // server runs in UTC, so between midnight and 9am KST its date differs
  // from the client's and hydration blows up (React #423). Render an
  // empty shell until mounted, then compute dates client-side only.
  const [mounted, setMounted] = useState(false);
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [collapsed, setCollapsed] = useState(false);
  const [eventDates, setEventDates] = useState<Set<string>>(new Set());

  // Load persisted collapse state (+ flip the mounted gate).
  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (collapsed) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await getEvents(year, month);
        if (cancelled) return;
        const set = new Set<string>();
        for (const ev of events) {
          const d = new Date(ev.start_at);
          set.add(ymd(d.getFullYear(), d.getMonth(), d.getDate()));
        }
        setEventDates(set);
      } catch {
        // ignore — sidebar is non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, month, collapsed]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const nav = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setYear(y);
    setMonth(m);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const days = getCalendarDays(year, month);
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();
  const todayDate = today.getDate();

  if (!mounted) {
    // Static shell — must match the SSR output exactly.
    return <div className="px-2 pb-2" />;
  }

  return (
    <div className="px-2 pb-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-center gap-1 rounded-lg px-1.5 py-1 text-left text-2xs font-semibold text-charcoal-300 hover:bg-charcoal-800/50"
          aria-expanded={!collapsed}
        >
          <svg
            className={`h-3 w-3 shrink-0 text-charcoal-500 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
          <span className="flex-1 truncate">
            {isCurrentMonth
              ? `${year}년 ${month + 1}월 ${todayDate}일 (${DAYS_SUN_FIRST[today.getDay()]})`
              : `${year}년 ${month + 1}월`}
          </span>
        </button>
        {!collapsed && (
          <>
            <button
              type="button"
              onClick={() => nav(-1)}
              aria-label="이전 달"
              className="rounded p-1 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => nav(1)}
              aria-label="다음 달"
              className="rounded p-1 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="mt-2 grid grid-cols-7 gap-0.5 px-0.5 text-center">
            {DAYS_MON.map((d, i) => (
              <span
                key={d}
                className={`text-3xs font-medium ${
                  i === 5
                    ? "text-blue-400/70"
                    : i === 6
                      ? "text-navy-400/70"
                      : "text-charcoal-500"
                }`}
              >
                {d}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-0.5 px-0.5">
            {days.map((day, i) => {
              if (!day) {
                return <span key={`e${i}`} className="h-6" />;
              }
              const colIdx = i % 7;
              const isToday = isCurrentMonth && day === todayDate;
              const key = ymd(year, month, day);
              const hasEvent = eventDates.has(key);
              return (
                <Link
                  key={i}
                  href={`/${username}/calendar?d=${key}`}
                  className={`relative flex h-6 items-center justify-center rounded text-2xs font-medium transition-colors ${
                    isToday
                      ? "bg-navy-500 text-white"
                      : colIdx === 5
                        ? "text-blue-400/80 hover:bg-charcoal-800/60"
                        : colIdx === 6
                          ? "text-navy-400/80 hover:bg-charcoal-800/60"
                          : "text-charcoal-300 hover:bg-charcoal-800/60"
                  }`}
                >
                  {day}
                  {hasEvent && !isToday && (
                    <span className="absolute bottom-[1px] h-[3px] w-[3px] rounded-full bg-navy-400" />
                  )}
                </Link>
              );
            })}
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={goToday}
              className="mt-1.5 w-full rounded px-1.5 py-0.5 text-2xs text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
            >
              오늘로
            </button>
          )}
        </>
      )}
    </div>
  );
}
