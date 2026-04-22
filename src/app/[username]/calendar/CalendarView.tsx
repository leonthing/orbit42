"use client";

import { useState, useTransition, useCallback, useMemo, useEffect } from "react";
import {
  getCompletedKeys,
  toggleEventCompletion,
} from "@/lib/event-completions";
import {
  type Event,
  type EventInput,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  fetchWeekDays,
} from "./actions";
import LifeCalendarViewExternal from "./LifeCalendarView";
import type { LifeMemory } from "./life-actions";
import { WeekCalendar } from "@/components/WeekCalendar";
import type { WeekDay, WeekItem } from "@/lib/profile-week";
import type { Calendar } from "@/lib/calendars-types";

// ─── Helpers ────────────────────────────────────────────────

const DAYS_MON = ["월", "화", "수", "목", "금", "토", "일"];

type ViewMode = "life" | "year" | "quarter" | "month" | "week";

/** ISO 8601 week number (Monday-start) */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get calendar grid days for a month (Monday-start). Returns (number|null)[] */
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // Convert Sunday-start to Monday-start: Mon=0, Tue=1 ... Sun=6
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function toLocalDateStr(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function getWeekDates(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  const dow = date.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(year, month, day + mondayOffset);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getQuarterForMonth(month: number): number {
  return Math.floor(month / 3);
}

function getQuarterMonths(quarter: number): [number, number, number] {
  const start = quarter * 3;
  return [start, start + 1, start + 2] as [number, number, number];
}

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

// ─── Types ──────────────────────────────────────────────────

type FormData = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  calendarId: string;
};

const emptyForm = (date?: string, calendarId?: string): FormData => ({
  title: "",
  description: "",
  date: date ?? "",
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  calendarId: calendarId ?? "",
});

// ─── Component ──────────────────────────────────────────────

export default function CalendarView({
  username,
  initialEvents,
  initialYear,
  initialMonth,
  googleConnected = false,
  birthDate = null,
  initialMemories = [],
  initialWeekDays,
  initialSelectedCalendars,
  myCalendars = [],
  viewerIsOwner = false,
}: {
  username: string;
  initialEvents: Event[];
  initialYear: number;
  initialMonth: number;
  googleConnected?: boolean;
  birthDate?: string | null;
  initialMemories?: LifeMemory[];
  initialWeekDays: WeekDay[];
  initialSelectedCalendars?: string[];
  myCalendars?: Calendar[];
  viewerIsOwner?: boolean;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [detailEvent, setDetailEvent] = useState<WeekItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const defaultCalendarId = useMemo(
    () => myCalendars.find((c) => c.is_default)?.id ?? myCalendars[0]?.id ?? "",
    [myCalendars],
  );
  const [form, setForm] = useState<FormData>(() =>
    emptyForm(undefined, defaultCalendarId),
  );
  const [isPending, startTransition] = useTransition();
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>(() => {
    if (initialSelectedCalendars && initialSelectedCalendars.length > 0) {
      return initialSelectedCalendars;
    }
    if (myCalendars.length > 0) {
      const def = myCalendars.find((c) => c.is_default) ?? myCalendars[0];
      return [def.id];
    }
    return [];
  });
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [quarter, setQuarter] = useState(getQuarterForMonth(initialMonth));
  const [weekDays, setWeekDays] = useState<WeekDay[]>(initialWeekDays);

  // Load completion marks whenever visible events change. We pull keys
  // from BOTH the month events and the week-day items so checkboxes
  // work in whichever view the user lands on.
  useEffect(() => {
    const keySet = new Set<string>();
    for (const e of events) keySet.add(e.id);
    for (const d of weekDays) {
      for (const it of d.items) {
        if (it.kind === "event") keySet.add(it.id);
      }
    }
    const keys = Array.from(keySet);
    if (keys.length === 0) {
      setCompleted(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const done = await getCompletedKeys(keys);
      if (!cancelled) setCompleted(new Set(done));
    })();
    return () => {
      cancelled = true;
    };
  }, [events, weekDays]);

  const handleToggleComplete = useCallback(async (eventId: string) => {
    const isDone = completed.has(eventId);
    // Optimistic update.
    setCompleted((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
    const res = await toggleEventCompletion(eventId, !isDone);
    if ("error" in res) {
      // Roll back.
      setCompleted((prev) => {
        const next = new Set(prev);
        if (isDone) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
    }
  }, [completed]);

  const refetchWeekDays = useCallback(
    (anchor: Date, cals?: string[]) => {
      // Monday of the week containing the anchor date
      const a = new Date(anchor);
      a.setHours(0, 0, 0, 0);
      const dow = (a.getDay() + 6) % 7;
      a.setDate(a.getDate() - dow);
      startTransition(async () => {
        const days = await fetchWeekDays(
          username,
          a.toISOString(),
          cals ?? selectedCalendars,
        );
        const revived = days.map((d) => ({
          ...d,
          date: new Date(d.date),
        }));
        setWeekDays(revived);
      });
    },
    [username, selectedCalendars],
  );

  const today = useMemo(() => new Date(), []);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const days = getCalendarDays(year, month);


  // ── Fetch events for a given month ──

  const fetchEvents = useCallback(
    (y: number, m: number, cals?: string[]) => {
      startTransition(async () => {
        const data = await getEvents(y, m, cals ?? selectedCalendars);
        setEvents(data);
      });
    },
    [selectedCalendars],
  );

  // ── Fetch events for multiple months (year/quarter views) ──

  const fetchMultiMonthEvents = useCallback(
    (y: number, months: number[], cals?: string[]) => {
      startTransition(async () => {
        const calendars = cals ?? selectedCalendars;
        const allEvents: Event[] = [];
        for (const m of months) {
          const data = await getEvents(y, m, calendars);
          allEvents.push(...data);
        }
        // Deduplicate by id
        const seen = new Set<string>();
        const deduped = allEvents.filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
        setEvents(deduped);
      });
    },
    [selectedCalendars],
  );

  // ── Navigation ──

  const navigateMonth = useCallback(
    (dir: -1 | 1) => {
      let newMonth = month + dir;
      let newYear = year;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      setYear(newYear);
      setMonth(newMonth);
      setSelectedDay(null);
      fetchEvents(newYear, newMonth);
    },
    [month, year, fetchEvents],
  );

  const navigateWeek = useCallback(
    (dir: -1 | 1) => {
      const current = new Date(year, month, selectedDay ?? today.getDate());
      current.setDate(current.getDate() + dir * 7);
      const newYear = current.getFullYear();
      const newMonth = current.getMonth();
      const newDay = current.getDate();
      setYear(newYear);
      setMonth(newMonth);
      setSelectedDay(newDay);
      fetchEvents(newYear, newMonth);
      refetchWeekDays(current);
    },
    [year, month, selectedDay, today, fetchEvents, refetchWeekDays],
  );

  const navigateQuarter = useCallback(
    (dir: -1 | 1) => {
      let newQuarter = quarter + dir;
      let newYear = year;
      if (newQuarter < 0) {
        newQuarter = 3;
        newYear--;
      } else if (newQuarter > 3) {
        newQuarter = 0;
        newYear++;
      }
      setYear(newYear);
      setQuarter(newQuarter);
      setMonth(newQuarter * 3);
      setSelectedDay(null);
      fetchMultiMonthEvents(newYear, getQuarterMonths(newQuarter));
    },
    [quarter, year, fetchMultiMonthEvents],
  );

  const navigateYear = useCallback(
    (dir: -1 | 1) => {
      const newYear = year + dir;
      setYear(newYear);
      setSelectedDay(null);
      fetchMultiMonthEvents(newYear, Array.from({ length: 12 }, (_, i) => i));
    },
    [year, fetchMultiMonthEvents],
  );

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (viewMode === "month") navigateMonth(dir);
      else if (viewMode === "week") navigateWeek(dir);
      else if (viewMode === "quarter") navigateQuarter(dir);
      else navigateYear(dir);
    },
    [viewMode, navigateMonth, navigateWeek, navigateQuarter, navigateYear],
  );

  const goToToday = useCallback(() => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setSelectedDay(t.getDate());
    setQuarter(getQuarterForMonth(t.getMonth()));
    if (viewMode === "year") {
      fetchMultiMonthEvents(t.getFullYear(), Array.from({ length: 12 }, (_, i) => i));
    } else if (viewMode === "quarter") {
      const q = getQuarterForMonth(t.getMonth());
      fetchMultiMonthEvents(t.getFullYear(), getQuarterMonths(q));
    } else {
      fetchEvents(t.getFullYear(), t.getMonth());
    }
  }, [viewMode, fetchEvents, fetchMultiMonthEvents]);

  const switchView = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (mode === "year") {
        fetchMultiMonthEvents(year, Array.from({ length: 12 }, (_, i) => i));
      } else if (mode === "quarter") {
        const q = getQuarterForMonth(month);
        setQuarter(q);
        fetchMultiMonthEvents(year, getQuarterMonths(q));
      } else if (mode === "week") {
        if (!selectedDay) setSelectedDay(today.getDate());
        fetchEvents(year, month);
        refetchWeekDays(new Date(year, month, selectedDay ?? today.getDate()));
      } else {
        fetchEvents(year, month);
      }
    },
    [year, month, today, selectedDay, fetchEvents, fetchMultiMonthEvents, refetchWeekDays],
  );

  // ── Helpers ──

  const eventsForDay = useCallback(
    (y: number, m: number, day: number) =>
      events.filter((e) => {
        const d = new Date(e.start_at);
        return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
      }),
    [events],
  );

  const eventsForCurrentDay = (day: number) => eventsForDay(year, month, day);

  const selectedDayEvents = selectedDay ? eventsForCurrentDay(selectedDay) : [];

  // ── Form ──

  const openCreateForm = (day?: number, forYear?: number, forMonth?: number) => {
    const y = forYear ?? year;
    const m = forMonth ?? month;
    const dateStr = day
      ? toLocalDateStr(y, m, day)
      : toLocalDateStr(y, m, selectedDay ?? today.getDate());
    setEditingEvent(null);
    setForm(emptyForm(dateStr, defaultCalendarId));
    setShowForm(true);
  };

  const openEditForm = (event: Event) => {
    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? "",
      date: toLocalDateStr(start.getFullYear(), start.getMonth(), start.getDate()),
      startTime: event.all_day
        ? "09:00"
        : `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      endTime: event.all_day
        ? "10:00"
        : `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      allDay: event.all_day,
      calendarId: event.calendar_id ?? defaultCalendarId,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingEvent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;

    const startAt = form.allDay
      ? `${form.date}T00:00:00`
      : `${form.date}T${form.startTime}:00`;
    const endAt = form.allDay
      ? `${form.date}T23:59:59`
      : `${form.date}T${form.endTime}:00`;

    const input: EventInput = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      all_day: form.allDay,
      calendar_id: form.calendarId || null,
    };

    startTransition(async () => {
      if (editingEvent) {
        await updateEvent(editingEvent.id, input);
      } else {
        await createEvent(input);
      }
      const data = await getEvents(year, month, selectedCalendars);
      setEvents(data);
      closeForm();
    });
  };

  const handleDelete = (eventId: string) => {
    startTransition(async () => {
      await deleteEvent(eventId);
      const data = await getEvents(year, month, selectedCalendars);
      setEvents(data);
    });
  };

  const toggleCalendar = (calId: string) => {
    const next = selectedCalendars.includes(calId)
      ? selectedCalendars.filter((c) => c !== calId)
      : [...selectedCalendars, calId];
    setSelectedCalendars(next);
    startTransition(async () => {
      const data = await getEvents(year, month, next);
      setEvents(data);
    });
    refetchWeekDays(
      new Date(year, month, selectedDay ?? today.getDate()),
      next,
    );
  };

  // ── Navigation label ──

  const getHeaderLabel = () => {
    if (viewMode === "year") return `${year}년`;
    if (viewMode === "quarter") return `${year}년 Q${quarter + 1}`;
    if (viewMode === "week") {
      const weekDates = getWeekDates(year, month, selectedDay ?? today.getDate());
      const first = weekDates[0];
      const last = weekDates[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일 - ${last.getDate()}일`;
      }
      return `${first.getMonth() + 1}월 ${first.getDate()}일 - ${last.getMonth() + 1}월 ${last.getDate()}일`;
    }
    return `${year}년 ${month + 1}월`;
  };

  const isViewCurrent = () => {
    const t = new Date();
    if (viewMode === "year") return year === t.getFullYear();
    if (viewMode === "quarter") return year === t.getFullYear() && quarter === getQuarterForMonth(t.getMonth());
    if (viewMode === "month") return isCurrentMonth;
    // week
    const weekDates = getWeekDates(year, month, selectedDay ?? today.getDate());
    return weekDates.some(
      (d) => d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate(),
    );
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">캘린더</h1>
          <p className="mt-1 text-sm text-charcoal-500">일정 및 시간 관리</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {myCalendars.length > 0 ? (
            <div className="relative">
              <button
                onClick={() => setShowCalendarPicker(!showCalendarPicker)}
                className="flex items-center gap-1.5 rounded-lg border border-charcoal-800 bg-charcoal-900/40 px-3 py-2 text-xs font-medium text-charcoal-200 hover:border-charcoal-700"
              >
                <span className="inline-flex -space-x-1">
                  {myCalendars
                    .filter((c) => selectedCalendars.includes(c.id))
                    .slice(0, 3)
                    .map((c) => (
                      <span
                        key={c.id}
                        className="h-2.5 w-2.5 rounded-full ring-2 ring-[rgb(var(--bg-base))]"
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                </span>
                캘린더 {selectedCalendars.length}개
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showCalendarPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCalendarPicker(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-3 shadow-2xl">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-charcoal-400">내 캘린더</p>
                      <div className="flex gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const all = myCalendars.map((c) => c.id);
                            setSelectedCalendars(all);
                            startTransition(async () => {
                              const data = await getEvents(year, month, all);
                              setEvents(data);
                            });
                            refetchWeekDays(
                              new Date(year, month, selectedDay ?? today.getDate()),
                              all,
                            );
                          }}
                          className="rounded px-1.5 py-0.5 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-200"
                        >
                          전체
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCalendars([]);
                            startTransition(async () => {
                              const data = await getEvents(year, month, []);
                              setEvents(data);
                            });
                            refetchWeekDays(
                              new Date(year, month, selectedDay ?? today.getDate()),
                              [],
                            );
                          }}
                          className="rounded px-1.5 py-0.5 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-200"
                        >
                          해제
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 space-y-0.5 overflow-y-auto">
                      {myCalendars.map((cal) => (
                        <label
                          key={cal.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-charcoal-800/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCalendars.includes(cal.id)}
                            onChange={() => toggleCalendar(cal.id)}
                            className="h-3.5 w-3.5 rounded border-charcoal-600 bg-charcoal-800 text-red-500 focus:ring-red-500/50"
                          />
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: cal.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-charcoal-200">
                            {cal.name}
                            {cal.is_default && (
                              <span className="ml-1 text-[10px] text-charcoal-500">기본</span>
                            )}
                          </span>
                          <span className="text-[10px] text-charcoal-500">
                            {cal.source === "google" ? "G" : "N"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : !googleConnected ? (
            <a
              href="/api/google"
              className="flex items-center gap-2 rounded-lg border border-charcoal-700 px-3 py-2 text-xs font-medium text-charcoal-400 hover:border-charcoal-600 hover:text-charcoal-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google Calendar 연동
            </a>
          ) : null}
          <button
            onClick={() => openCreateForm()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            + 새 일정
          </button>
        </div>
      </div>

      {/* View Tabs + Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View mode tabs */}
        <div className="flex overflow-x-auto rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-0.5">
          {(
            [
              ["life", "Life"],
              ["year", "연"],
              ["quarter", "분기"],
              ["month", "월"],
              ["week", "주"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => switchView(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? "bg-red-600 text-white"
                  : "text-charcoal-400 hover:text-charcoal-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Navigation (hidden for Life view) */}
        {viewMode !== "life" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg px-3 py-1.5 text-sm text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-200"
            >
              &larr;
            </button>
            <h2 className="min-w-[140px] text-center text-lg font-semibold text-charcoal-200">
              {getHeaderLabel()}
            </h2>
            <button
              onClick={() => navigate(1)}
              className="rounded-lg px-3 py-1.5 text-sm text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-200"
            >
              &rarr;
            </button>
            {!isViewCurrent() && (
              <button
                onClick={goToToday}
                className="rounded-md bg-charcoal-800/60 px-2.5 py-1 text-xs text-charcoal-400 hover:text-charcoal-200"
              >
                오늘
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main content area */}
      {viewMode === "month" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Month Calendar Grid */}
          <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-3 md:p-5">
            {/* Day headers with week number column */}
            <div className="grid grid-cols-[1.5rem_repeat(7,1fr)] gap-0.5 md:grid-cols-[2rem_repeat(7,1fr)] md:gap-1">
              <div className="py-2 text-center text-[10px] font-medium text-charcoal-600">W</div>
              {DAYS_MON.map((d, i) => (
                <div
                  key={d}
                  className={`py-2 text-center text-xs font-medium ${
                    i === 5 ? "text-blue-400/70" : i === 6 ? "text-red-400/70" : "text-charcoal-500"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Date cells with week numbers */}
            <div className="grid grid-cols-[1.5rem_repeat(7,1fr)] gap-0.5 md:grid-cols-[2rem_repeat(7,1fr)] md:gap-1">
              {days.map((day, i) => {
                const isToday = isCurrentMonth && day === today.getDate();
                const isSelected = day === selectedDay;
                const dayEvents = day ? eventsForCurrentDay(day) : [];
                const colIdx = i % 7;
                const isSaturday = colIdx === 5;
                const isSunday = colIdx === 6;

                // Show week number at the start of each row (Monday)
                const showWeekNum = colIdx === 0;
                const weekNum = showWeekNum && day
                  ? getISOWeekNumber(new Date(year, month, day))
                  : showWeekNum && !day
                    ? (() => {
                        // Find first real day in this row
                        for (let j = i; j < i + 7 && j < days.length; j++) {
                          if (days[j]) return getISOWeekNumber(new Date(year, month, days[j]!));
                        }
                        return null;
                      })()
                    : null;

                return (
                  <>
                    {showWeekNum && (
                      <div key={`w${i}`} className="flex h-14 items-start justify-center pt-1 md:h-20 md:pt-2">
                        <span className="text-[10px] font-medium text-charcoal-600">
                          {weekNum}
                        </span>
                      </div>
                    )}
                    <button
                      key={i}
                      disabled={!day}
                      onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                      className={`flex h-14 flex-col items-start rounded-lg p-1 text-left text-sm transition-colors md:h-20 md:p-2 ${
                      !day
                        ? ""
                        : isToday
                          ? "bg-red-600/10"
                          : isSelected
                            ? "bg-charcoal-800/60"
                            : "hover:bg-charcoal-800/50"
                    } ${!day ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {day && (
                      <>
                        <span
                          className={`flex h-6 w-6 items-center justify-center text-xs font-medium ${
                            isToday
                              ? "rounded-full bg-red-600 text-white"
                              : isSunday
                                ? "text-red-400/70"
                                : isSaturday
                                  ? "text-blue-400/70"
                                  : "text-charcoal-300"
                          }`}
                        >
                          {day}
                        </span>
                        {dayEvents.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <span
                                key={ev.id}
                                className={`h-1.5 w-1.5 rounded-full ${ev.source === "google" ? "bg-blue-400" : "bg-red-400"}`}
                                title={ev.title}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[10px] text-charcoal-500">
                                +{dayEvents.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                  </>
                );
              })}
            </div>

            {isPending && (
              <div className="mt-2 text-center text-xs text-charcoal-500">불러오는 중...</div>
            )}
          </div>

          {/* Sidebar: Selected Day Events */}
          <div className="space-y-4">
            <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
              {selectedDay ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-charcoal-200">
                      {month + 1}월 {selectedDay}일
                    </h3>
                    <button
                      onClick={() => openCreateForm(selectedDay)}
                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      + 추가
                    </button>
                  </div>
                  {selectedDayEvents.length === 0 ? (
                    <p className="text-sm text-charcoal-600">일정이 없습니다</p>
                  ) : (
                    <EventList
                      events={selectedDayEvents}
                      onEdit={openEditForm}
                      onDelete={handleDelete}
                      completed={completed}
                      onToggleComplete={handleToggleComplete}
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-charcoal-600">날짜를 선택하세요</p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === "week" && (
        <WeekCalendar
          username={username}
          days={weekDays}
          viewerIsOwner={viewerIsOwner}
          completedKeys={completed}
          onToggleComplete={handleToggleComplete}
          onEventClick={(item) => setDetailEvent(item)}
          emptyMessage={
            viewerIsOwner
              ? "이 주가 비어있어요. 슬롯을 열거나 이벤트를 추가해보세요."
              : "이 주에 공개된 일정이나 예약 가능한 시간이 없어요."
          }
        />
      )}

      {detailEvent && (
        <EventDetailModal
          item={detailEvent}
          isCompleted={completed.has(detailEvent.id)}
          canToggleComplete={!!viewerIsOwner}
          onToggleComplete={() => handleToggleComplete(detailEvent.id)}
          onClose={() => setDetailEvent(null)}
        />
      )}

      {viewMode === "year" && (
        <YearView
          year={year}
          events={events}
          eventsForDay={eventsForDay}
          today={today}
          onMonthClick={(m) => {
            setMonth(m);
            setViewMode("month");
            setSelectedDay(null);
            fetchEvents(year, m);
          }}
        />
      )}

      {viewMode === "quarter" && (
        <QuarterView
          year={year}
          quarter={quarter}
          events={events}
          eventsForDay={eventsForDay}
          today={today}
          onDayClick={(m, d) => {
            setMonth(m);
            setSelectedDay(d);
            setViewMode("month");
            fetchEvents(year, m);
          }}
        />
      )}

      {/* ── Life Calendar ── */}
      {viewMode === "life" && (
        <LifeCalendarViewExternal birthDate={birthDate} initialMemories={initialMemories} />
      )}

      {isPending && viewMode !== "month" && viewMode !== "life" && (
        <div className="text-center text-xs text-charcoal-500">불러오는 중...</div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-base))] p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-charcoal-100">
              {editingEvent ? "일정 수정" : "새 일정"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1 block text-xs font-medium text-charcoal-400">제목</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 focus:border-red-500 focus:outline-none"
                  placeholder="일정 제목"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-charcoal-400">설명</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 focus:border-red-500 focus:outline-none resize-none"
                  placeholder="메모 (선택)"
                />
              </div>

              {/* Calendar picker */}
              {myCalendars.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-charcoal-400">
                    캘린더
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          myCalendars.find((c) => c.id === form.calendarId)?.color ??
                          "#6366f1",
                      }}
                    />
                    <select
                      value={form.calendarId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, calendarId: e.target.value }))
                      }
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none"
                    >
                      {myCalendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.is_default ? " (기본)" : ""} ·{" "}
                          {c.visibility === "public"
                            ? "공개"
                            : c.visibility === "followers"
                              ? "팔로워"
                              : "비공개"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="mb-1 block text-xs font-medium text-charcoal-400">날짜</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none"
                />
              </div>

              {/* All day toggle */}
              <label className="flex items-center gap-2 text-sm text-charcoal-300">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                  className="h-4 w-4 rounded border-charcoal-700 bg-charcoal-800/50 text-red-600 focus:ring-red-500"
                />
                종일
              </label>

              {/* Time inputs */}
              {!form.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal-400">
                      시작 시간
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal-400">
                      종료 시간
                    </label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg px-4 py-2 text-sm text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {isPending ? "저장 중..." : editingEvent ? "수정" : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Event List (shared between views) ─────────────────────

function EventList({
  events,
  onEdit,
  onDelete,
  completed,
  onToggleComplete,
}: {
  events: Event[];
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => void;
  completed: Set<string>;
  onToggleComplete: (eventId: string) => void;
}) {
  return (
    <ul className="space-y-3">
      {events.map((ev) => {
        const isDone = completed.has(ev.id);
        return (
        <li
          key={ev.id}
          className={`group rounded-lg border p-3 transition-opacity ${
            isDone
              ? "border-charcoal-800/40 bg-charcoal-800/10 opacity-60"
              : "border-charcoal-800/40 bg-charcoal-800/20"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => onToggleComplete(ev.id)}
              aria-label={isDone ? "미완료로 표시" : "완료로 표시"}
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                isDone
                  ? "border-red-500 bg-red-600 text-white"
                  : "border-charcoal-600 hover:border-charcoal-400"
              }`}
            >
              {isDone && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p
                  className={`text-sm font-medium truncate ${
                    isDone
                      ? "text-charcoal-500 line-through"
                      : "text-charcoal-200"
                  }`}
                >
                  {ev.title}
                </p>
                {ev.source === "google" && (
                  <span className="shrink-0 rounded bg-blue-500/10 px-1 py-0.5 text-[10px] text-blue-400">G</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-charcoal-500">
                {ev.all_day
                  ? "종일"
                  : `${formatTime(ev.start_at)} - ${formatTime(ev.end_at)}`}
              </p>
              {ev.description && (
                <p className="mt-1 text-xs text-charcoal-500 line-clamp-2">
                  {ev.description}
                </p>
              )}
            </div>
            {ev.source !== "google" && (
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => onEdit(ev)}
                  className="rounded p-1 text-charcoal-500 hover:bg-charcoal-700/50 hover:text-charcoal-300"
                  title="수정"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(ev.id)}
                  className="rounded p-1 text-charcoal-500 hover:bg-red-900/30 hover:text-red-400"
                  title="삭제"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </li>
        );
      })}
    </ul>
  );
}


// ─── Year View ──────────────────────────────────────────────

function YearView({
  year,
  events,
  eventsForDay,
  today,
  onMonthClick,
}: {
  year: number;
  events: Event[];
  eventsForDay: (y: number, m: number, d: number) => Event[];
  today: Date;
  onMonthClick: (month: number) => void;
}) {
  void events; // used via eventsForDay

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, monthIdx) => {
        const miniDays = getCalendarDays(year, monthIdx);
        const isCurrentMonth = year === today.getFullYear() && monthIdx === today.getMonth();

        return (
          <button
            key={monthIdx}
            onClick={() => onMonthClick(monthIdx)}
            className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-3 text-left hover:border-charcoal-700/60 hover:bg-charcoal-800/30 transition-colors"
          >
            <h3
              className={`mb-2 text-sm font-semibold ${
                isCurrentMonth ? "text-red-400" : "text-charcoal-300"
              }`}
            >
              {MONTH_NAMES[monthIdx]}
            </h3>
            {/* Mini day headers */}
            <div className="grid grid-cols-7 gap-0">
              {DAYS_MON.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-[8px] font-medium ${
                    i === 5 ? "text-blue-400/50" : i === 6 ? "text-red-400/50" : "text-charcoal-600"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Mini date cells */}
            <div className="grid grid-cols-7 gap-0">
              {miniDays.map((day, i) => {
                const isToday = isCurrentMonth && day === today.getDate();
                const hasEvents = day ? eventsForDay(year, monthIdx, day).length > 0 : false;
                return (
                  <div
                    key={i}
                    className="flex h-4 items-center justify-center"
                  >
                    {day && (
                      <div className="relative flex items-center justify-center">
                        <span
                          className={`text-[9px] leading-none ${
                            isToday
                              ? "flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-white"
                              : "text-charcoal-500"
                          }`}
                        >
                          {day}
                        </span>
                        {hasEvents && !isToday && (
                          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-0.5 rounded-full bg-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Quarter View ───────────────────────────────────────────

function QuarterView({
  year,
  quarter,
  events,
  eventsForDay,
  today,
  onDayClick,
}: {
  year: number;
  quarter: number;
  events: Event[];
  eventsForDay: (y: number, m: number, d: number) => Event[];
  today: Date;
  onDayClick: (month: number, day: number) => void;
}) {
  const months = getQuarterMonths(quarter);
  void events; // used via eventsForDay

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {months.map((monthIdx) => {
        const miniDays = getCalendarDays(year, monthIdx);
        const isCurrentMonth = year === today.getFullYear() && monthIdx === today.getMonth();

        return (
          <div
            key={monthIdx}
            className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-4"
          >
            <h3
              className={`mb-3 text-center text-sm font-semibold ${
                isCurrentMonth ? "text-red-400" : "text-charcoal-300"
              }`}
            >
              {MONTH_NAMES[monthIdx]}
            </h3>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS_MON.map((d, i) => (
                <div
                  key={d}
                  className={`py-1 text-center text-[10px] font-medium ${
                    i === 5 ? "text-blue-400/60" : i === 6 ? "text-red-400/60" : "text-charcoal-600"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Date cells */}
            <div className="grid grid-cols-7 gap-1">
              {miniDays.map((day, i) => {
                const isToday = isCurrentMonth && day === today.getDate();
                const dayEvents = day ? eventsForDay(year, monthIdx, day) : [];
                const colIdx = i % 7;
                const isSat = colIdx === 5;
                const isSun = colIdx === 6;

                return (
                  <button
                    key={i}
                    disabled={!day}
                    onClick={() => day && onDayClick(monthIdx, day)}
                    className={`flex h-8 flex-col items-center justify-center rounded-md text-xs transition-colors ${
                      !day
                        ? "cursor-default"
                        : isToday
                          ? "bg-red-600/10 cursor-pointer"
                          : "cursor-pointer hover:bg-charcoal-800/50"
                    }`}
                  >
                    {day && (
                      <div className="relative flex items-center justify-center">
                        <span
                          className={`flex h-5 w-5 items-center justify-center text-[11px] font-medium ${
                            isToday
                              ? "rounded-full bg-red-600 text-white"
                              : isSun
                                ? "text-red-400/70"
                                : isSat
                                  ? "text-blue-400/70"
                                  : "text-charcoal-400"
                          }`}
                        >
                          {day}
                        </span>
                        {dayEvents.length > 0 && !isToday && (
                          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-red-400" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// LifeCalendarView is now in LifeCalendarView.tsx

function EventDetailModal({
  item,
  isCompleted,
  canToggleComplete,
  onToggleComplete,
  onClose,
}: {
  item: WeekItem;
  isCompleted: boolean;
  canToggleComplete: boolean;
  onToggleComplete: () => void;
  onClose: () => void;
}) {
  if (item.kind !== "event") return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm"
            style={{ background: item.color }}
          />
          <div className="min-w-0 flex-1">
            <h3
              className={`text-base font-semibold ${
                isCompleted
                  ? "text-charcoal-500 line-through"
                  : "text-charcoal-100"
              }`}
            >
              {item.title}
            </h3>
            <p className="mt-1 text-xs text-charcoal-500">
              {item.all_day
                ? "종일"
                : `${fmt(item.start_at)} – ${new Date(item.end_at).toLocaleTimeString(
                    "ko-KR",
                    {
                      timeZone: "Asia/Seoul",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    },
                  )}`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {canToggleComplete ? (
            <button
              type="button"
              onClick={() => {
                onToggleComplete();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                isCompleted
                  ? "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                  : "bg-red-600 text-white hover:bg-red-500"
              }`}
            >
              {isCompleted ? "완료 취소" : "완료로 표시"}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-charcoal-300 hover:bg-charcoal-800/60"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

