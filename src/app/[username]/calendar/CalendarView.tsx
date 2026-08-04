"use client";

import { EventAssetPanel } from "./EventAssetPanel";
import { EventParticipantsPanel } from "./EventParticipantsPanel";
import { useState, useTransition, useCallback, useMemo, useEffect, useRef } from "react";
import {
  getCompletedKeys,
  toggleEventCompletion,
} from "@/lib/event-completions";
import { normalizeEventKey } from "@/lib/event-key";
import { Avatar } from "@/components/Avatar";
import {
  type Event,
  type EventInput,
  type InviteView,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  fetchWeekDays,
  getMyInvites,
  respondToEventInvite,
} from "./actions";
import LifeCalendarViewExternal from "./LifeCalendarView";
import type { LifeMemory } from "./life-actions";
import { WeekCalendar } from "@/components/WeekCalendar";
import type { WeekDay, WeekItem } from "@/lib/profile-week";
import type { Calendar } from "@/lib/calendars-types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useRouter, useSearchParams } from "next/navigation";

/** 초대받은 일정은 내 이벤트가 아니라 `invite:<참석행 id>` 로 구분한다. */
const INVITE_PREFIX = "invite:";
const INVITE_COLOR = "#a855f7";

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inviteToWeekItem(inv: InviteView): WeekItem {
  return {
    kind: "event",
    id: `${INVITE_PREFIX}${inv.id}`,
    start_at: inv.start_at,
    end_at: inv.end_at,
    all_day: inv.all_day,
    title: inv.title,
    color: INVITE_COLOR,
    // 아직 수락하지 않은 초대는 점선으로 — 확정 대기 예약과 같은 표현.
    tentative: inv.status === "invited",
  };
}

/** Parse a WeekItem event id back into its source+ids. */
function parseWeekItemId(
  id: string,
):
  | { kind: "native"; id: string }
  | { kind: "google"; gcalId: string; eventId: string }
  | null {
  if (id.startsWith("native:")) return { kind: "native", id: id.slice(7) };
  const idx = id.indexOf("::");
  if (idx > 0) {
    return {
      kind: "google",
      gcalId: id.slice(0, idx),
      eventId: id.slice(idx + 2),
    };
  }
  return null;
}

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
  /** 위치 — 자유 텍스트 (앱과 동일 계약) */
  location: string;
  /** 시작 전 이동시간(분) — 0 이면 없음 */
  travelMin: number;
};

const emptyForm = (date?: string, calendarId?: string): FormData => ({
  title: "",
  description: "",
  date: date ?? "",
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  calendarId: calendarId ?? "",
  location: "",
  travelMin: 0,
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const toast = useToast();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [detailEvent, setDetailEvent] = useState<WeekItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [quickEdit, setQuickEdit] = useState<
    | { event: Event; anchor: { x: number; y: number } }
    | null
  >(null);
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
  const [invites, setInvites] = useState<InviteView[]>([]);

  // 받은 초대는 내 캘린더에서만 의미가 있다. 주간 뷰가 달 경계를 넘나들어서
  // 보이는 달 앞뒤로 일주일씩 넉넉히 받아 둔다.
  useEffect(() => {
    if (!viewerIsOwner) return;
    const start = new Date(year, month, 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    end.setDate(end.getDate() + 7);
    let cancelled = false;
    getMyInvites(start.toISOString(), end.toISOString())
      .then((rows) => {
        if (!cancelled) setInvites(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [year, month, viewerIsOwner]);

  const invitesForDay = useCallback(
    (y: number, m: number, day: number) =>
      invites.filter((inv) =>
        isSameDay(new Date(inv.start_at), new Date(y, m, day)),
      ),
    [invites],
  );

  const pendingInvites = useMemo(
    () => invites.filter((inv) => inv.status === "invited"),
    [invites],
  );

  const respondToInvite = useCallback(
    async (inviteId: string, status: "accepted" | "declined") => {
      const res = await respondToEventInvite(inviteId, status);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (status === "declined") {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      } else {
        setInvites((prev) =>
          prev.map((i) => (i.id === inviteId ? { ...i, status } : i)),
        );
      }
      toast.success(status === "accepted" ? "초대를 수락했어요" : "초대를 거절했어요");
    },
    [toast],
  );

  // Load completion marks whenever visible events change. We pull keys
  // from BOTH the month events and the week-day items so checkboxes
  // work in whichever view the user lands on.
  useEffect(() => {
    const keySet = new Set<string>();
    for (const e of events) keySet.add(normalizeEventKey(e.id));
    for (const d of weekDays) {
      for (const it of d.items) {
        if (it.kind === "event") keySet.add(normalizeEventKey(it.id));
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
    // 남의 일정에 초대받은 것 — 완료 표시는 일정 주인의 몫이다.
    if (eventId.startsWith(INVITE_PREFIX)) return;
    const key = normalizeEventKey(eventId);
    const isDone = completed.has(key);
    // Optimistic update.
    setCompleted((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(key);
      else next.add(key);
      return next;
    });
    const res = await toggleEventCompletion(key, !isDone);
    if ("error" in res) {
      // Roll back.
      setCompleted((prev) => {
        const next = new Set(prev);
        if (isDone) next.add(key);
        else next.delete(key);
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
      // Week grid renders from weekDays state — without this the header
      // label jumps to today's week but the grid stays on the old week.
      if (viewMode === "week") {
        refetchWeekDays(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
      }
    }
  }, [viewMode, fetchEvents, fetchMultiMonthEvents, refetchWeekDays]);

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

  // ── URL `?d=YYYY-MM-DD` jump (from sidebar mini calendar) ──
  useEffect(() => {
    const d = searchParams?.get("d");
    if (!d) return;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m) return;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(day)) return;
    // Only act when the target differs from current state.
    if (y === year && mo === month && selectedDay === day) return;
    setYear(y);
    setMonth(mo);
    setSelectedDay(day);
    setQuarter(getQuarterForMonth(mo));
    if (viewMode === "year" || viewMode === "quarter" || viewMode === "life") {
      setViewMode("week");
    }
    fetchEvents(y, mo);
    refetchWeekDays(new Date(y, mo, day));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
  const selectedDayInvites = selectedDay
    ? invitesForDay(year, month, selectedDay)
    : [];

  // Calendar color lookup: prefer the user's calendar color, fall back to
  // a source-based default (red for local, blue for google).
  const calendarColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of myCalendars) m.set(c.id, c.color);
    return m;
  }, [myCalendars]);
  const getEventColor = useCallback(
    (ev: Event): string => {
      if (ev.calendar_id && calendarColorMap.has(ev.calendar_id)) {
        return calendarColorMap.get(ev.calendar_id)!;
      }
      return ev.source === "google" ? "#4285f4" : "#ef4444";
    },
    [calendarColorMap],
  );

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
      location: (event as { location?: string | null }).location ?? "",
      travelMin: (event as { travel_min?: number | null }).travel_min ?? 0,
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
      location: form.location.trim() || null,
      travel_min: form.travelMin > 0 ? form.travelMin : null,
    };

    startTransition(async () => {
      if (editingEvent) {
        // Route to Google or native based on the synthetic id prefix.
        if (editingEvent.source === "google" && editingEvent.id.startsWith("gcal:")) {
          const rest = editingEvent.id.slice("gcal:".length);
          const idx = rest.indexOf("::");
          if (idx > 0) {
            const gcalId = rest.slice(0, idx);
            const eventId = rest.slice(idx + 2);
            const res = await updateGoogleEvent(gcalId, eventId, input);
            if ("error" in res) {
              toast.error(res.error);
              return;
            }
            toast.success("수정됐어요.");
          }
        } else {
          await updateEvent(editingEvent.id, input);
        }
      } else {
        await createEvent(input);
      }
      const data = await getEvents(year, month, selectedCalendars);
      setEvents(data);
      // Also refresh week view data so the detail modal reflects latest.
      router.refresh();
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

  const viewTabs = (
    <div className="flex shrink-0 overflow-x-auto rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-0.5">
      {(
        [
          ["life", "라이프"],
          ["year", "연"],
          ["quarter", "분기"],
          ["month", "월"],
          ["week", "주"],
        ] as const
      ).map(([mode, label]) => (
        <button
          key={mode}
          onClick={() => switchView(mode)}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === mode
              ? "bg-navy-500 text-white"
              : "text-charcoal-400 hover:text-charcoal-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // 내 캘린더에서는 내가 열어 둔 빈 슬롯을 그리지 않는다. 시간 단위로 쪼개져
  // 실제 일정을 덮어버려서 정작 봐야 할 게 안 보인다. 남의 캘린더에서는
  // "예약 가능한 시간"이 이 화면의 존재 이유라 그대로 보여준다.
  const displayWeekDays = useMemo(() => {
    const base = viewerIsOwner
      ? weekDays.map((d) => ({
          ...d,
          items: d.items.filter((i) => i.kind !== "slot"),
        }))
      : weekDays;
    if (!viewerIsOwner || invites.length === 0) return base;
    // 받은 초대를 같은 격자에 겹쳐 그린다 — 내 일정과 나란히 봐야 겹치는지 안다.
    return base.map((d) => {
      const dayInvites = invites.filter((inv) =>
        isSameDay(new Date(inv.start_at), new Date(d.date)),
      );
      if (dayInvites.length === 0) return d;
      return { ...d, items: [...d.items, ...dayInvites.map(inviteToWeekItem)] };
    });
  }, [weekDays, viewerIsOwner, invites]);

  // 날짜 이동 — 예전엔 툴바 아래 별도 줄이었다. 한 줄로 합쳐 캘린더에 높이를 넘긴다.
  const dateNav = (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(-1)}
        aria-label="이전"
        className="rounded-lg px-2 py-1.5 text-sm text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-200"
      >
        &larr;
      </button>
      <h2 className="min-w-[128px] text-center text-base font-semibold text-charcoal-200 sm:min-w-[150px] sm:text-lg">
        {getHeaderLabel()}
      </h2>
      <button
        onClick={() => navigate(1)}
        aria-label="다음"
        className="rounded-lg px-2 py-1.5 text-sm text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-200"
      >
        &rarr;
      </button>
      {!isViewCurrent() && (
        <button
          onClick={goToToday}
          className="ml-1 rounded-lg bg-charcoal-800/60 px-2.5 py-1 text-xs text-charcoal-400 hover:text-charcoal-200"
        >
          오늘
        </button>
      )}
    </div>
  );

  return (
    // 주간 뷰가 남은 높이를 전부 쓰도록 세로 flex 로 잡는다 (space-y 대신 gap).
    // h-full 이 아니라 flex-1 — 위에 체크리스트 같은 형제가 있어도 그만큼 줄어든다.
    <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-6">
      {/* 한 줄 툴바 — 뷰 전환 · 날짜 이동 · 캘린더 선택 · 새 일정.
          "캘린더 / 일정 및 시간 관리" 제목과 날짜 줄이 각각 한 줄씩 먹고 있었는데,
          사이드바에서 이미 현재 위치를 알 수 있어 지우고 높이를 격자에 넘겼다. */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">{viewTabs}</div>
        {viewMode !== "life" && dateNav}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
                <span className="hidden sm:inline">
                  캘린더 {selectedCalendars.length}개
                </span>
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
                      <div className="flex gap-1 text-2xs">
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
                            className="h-3.5 w-3.5 rounded border-charcoal-600 bg-charcoal-800 text-navy-400 focus:ring-navy-400/50"
                          />
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: cal.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-charcoal-200">
                            {cal.name}
                            {cal.is_default && (
                              <span className="ml-1 text-2xs text-charcoal-500">기본</span>
                            )}
                          </span>
                          <span className="text-2xs text-charcoal-500">
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
            className="rounded-lg bg-navy-500 px-3 py-2 text-sm font-medium text-white hover:bg-navy-400 sm:px-4"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ 새 일정</span>
          </button>
        </div>
      </div>

      {/* Mobile-only tabs row — desktop renders them inline in the header */}
      <div className="sm:hidden">{viewTabs}</div>

      {/* 아직 답하지 않은 초대 — 캘린더에도 점선으로 뜨지만, 답을 기다리는
          일은 눈에 먼저 걸려야 한다. */}
      {viewerIsOwner && pendingInvites.length > 0 && viewMode !== "life" && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/[0.06] p-3">
          <p className="mb-2 text-xs font-medium text-purple-300">
            받은 초대 {pendingInvites.length}건
          </p>
          <ul className="space-y-1.5">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-charcoal-900/40 px-2.5 py-2"
              >
                <Avatar
                  url={inv.inviterAvatar}
                  name={inv.inviterName || "초대"}
                  size={24}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-charcoal-200">
                    {inv.title}
                  </p>
                  <p className="truncate text-2xs text-charcoal-500">
                    {inv.inviterName ?? "누군가"}님 ·{" "}
                    {new Date(inv.start_at).toLocaleString("ko-KR", {
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                      ...(inv.all_day
                        ? {}
                        : { hour: "2-digit", minute: "2-digit", hour12: false }),
                    })}
                    {inv.all_day ? " (종일)" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => respondToInvite(inv.id, "accepted")}
                    className="rounded-lg bg-navy-500 px-2.5 py-1 text-2xs font-medium text-white hover:bg-navy-400"
                  >
                    수락
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToInvite(inv.id, "declined")}
                    className="rounded-lg border border-charcoal-700 px-2.5 py-1 text-2xs text-charcoal-400 hover:border-charcoal-600 hover:text-charcoal-200"
                  >
                    거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main content area */}
      {viewMode === "month" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Month Calendar Grid */}
          <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-3 md:p-5">
            {/* Day headers with week number column */}
            <div className="grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-0.5 md:grid-cols-[2rem_repeat(7,minmax(0,1fr))] md:gap-1">
              <div className="py-2 text-center text-2xs font-medium text-charcoal-600">W</div>
              {DAYS_MON.map((d, i) => (
                <div
                  key={d}
                  className={`py-2 text-center text-xs font-medium ${
                    i === 5 ? "text-blue-400/70" : i === 6 ? "text-navy-400/70" : "text-charcoal-500"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Date cells with week numbers */}
            <div className="grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-0.5 md:grid-cols-[2rem_repeat(7,minmax(0,1fr))] md:gap-1">
              {days.map((day, i) => {
                const isToday = isCurrentMonth && day === today.getDate();
                const isSelected = day === selectedDay;
                const dayEvents = day ? eventsForCurrentDay(day) : [];
                const dayInvites = day ? invitesForDay(year, month, day) : [];
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
                        <span className="text-2xs font-medium text-charcoal-600">
                          {weekNum}
                        </span>
                      </div>
                    )}
                    <div
                      key={i}
                      role={day ? "button" : undefined}
                      tabIndex={day ? 0 : undefined}
                      onClick={() =>
                        day && setSelectedDay(day === selectedDay ? null : day)
                      }
                      onKeyDown={(e) => {
                        if (!day) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedDay(day === selectedDay ? null : day);
                        }
                      }}
                      className={`flex h-20 flex-col items-stretch rounded-lg p-1 text-left text-sm transition-colors md:h-28 md:p-1.5 ${
                        !day
                          ? ""
                          : isToday
                            ? "bg-navy-500/10"
                            : isSelected
                              ? "bg-charcoal-800/60"
                              : "hover:bg-charcoal-800/50"
                      } ${!day ? "cursor-default" : "cursor-pointer"}`}
                    >
                      {day && (
                        <>
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center text-xs font-medium ${
                              isToday
                                ? "rounded-full bg-navy-500 text-white"
                                : isSunday
                                  ? "text-navy-400/70"
                                  : isSaturday
                                    ? "text-blue-400/70"
                                    : "text-charcoal-300"
                            }`}
                          >
                            {day}
                          </span>
                          {(dayEvents.length > 0 || dayInvites.length > 0) && (
                            <div className="mt-1 flex min-h-0 flex-1 flex-col gap-[2px] overflow-hidden">
                              {dayEvents.slice(0, 3).map((ev) => {
                                const color = getEventColor(ev);
                                const isDone = completed.has(normalizeEventKey(ev.id));
                                return (
                                  <button
                                    key={ev.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (viewerIsOwner) {
                                        setQuickEdit({
                                          event: ev,
                                          anchor: {
                                            x: e.clientX,
                                            y: e.clientY,
                                          },
                                        });
                                      }
                                    }}
                                    className={`flex min-w-0 items-center gap-1 truncate rounded-sm px-1 py-[1px] text-left text-2xs leading-tight hover:bg-charcoal-800/60 md:text-2xs ${
                                      ev.tentative ? "border border-dashed" : ""
                                    }`}
                                    title={ev.tentative ? `${ev.title} · 확정 대기` : ev.title}
                                    style={{
                                      color,
                                      borderColor: ev.tentative ? color : undefined,
                                    }}
                                  >
                                    <span
                                      className="inline-block h-[8px] w-[2px] shrink-0 rounded-[1px]"
                                      style={{
                                        backgroundColor: ev.tentative ? "transparent" : color,
                                        boxShadow: ev.tentative ? `inset 0 0 0 1px ${color}` : undefined,
                                      }}
                                    />
                                    <span
                                      className={`min-w-0 flex-1 truncate font-medium ${
                                        isDone ? "line-through opacity-60" : ""
                                      }`}
                                    >
                                      {ev.title}
                                    </span>
                                  </button>
                                );
                              })}
                              {dayEvents.length > 3 && (
                                <span className="px-1 text-2xs text-charcoal-500">
                                  +{dayEvents.length - 3}
                                </span>
                              )}
                              {dayInvites.slice(0, 2).map((inv) => (
                                <button
                                  key={inv.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailEvent(inviteToWeekItem(inv));
                                  }}
                                  title={`${inv.title} · ${inv.inviterName ?? "초대"}님의 초대`}
                                  className={`flex min-w-0 items-center gap-1 truncate rounded-sm px-1 py-[1px] text-left text-2xs leading-tight hover:bg-charcoal-800/60 ${
                                    inv.status === "invited"
                                      ? "border border-dashed"
                                      : ""
                                  }`}
                                  style={{
                                    color: INVITE_COLOR,
                                    borderColor:
                                      inv.status === "invited"
                                        ? INVITE_COLOR
                                        : undefined,
                                  }}
                                >
                                  <span className="truncate">{inv.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
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
                      className="rounded-lg bg-navy-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-400"
                    >
                      + 추가
                    </button>
                  </div>
                  {selectedDayEvents.length === 0 &&
                  selectedDayInvites.length === 0 ? (
                    <p className="text-sm text-charcoal-600">일정이 없습니다</p>
                  ) : (
                    <>
                      {selectedDayEvents.length > 0 && (
                        <EventList
                          events={selectedDayEvents}
                          onEdit={openEditForm}
                          onDelete={handleDelete}
                          completed={completed}
                          onToggleComplete={handleToggleComplete}
                        />
                      )}
                      {selectedDayInvites.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {selectedDayInvites.map((inv) => (
                            <li
                              key={inv.id}
                              className="rounded-lg border border-dashed border-purple-500/40 bg-purple-500/[0.06] p-3"
                            >
                              <p className="truncate text-sm font-medium text-charcoal-200">
                                {inv.title}
                              </p>
                              <p className="mt-0.5 text-xs text-charcoal-500">
                                {inv.all_day
                                  ? "종일"
                                  : `${formatTime(inv.start_at)} - ${formatTime(inv.end_at)}`}{" "}
                                · {inv.inviterName ?? "누군가"}님의 초대
                              </p>
                              {inv.status === "invited" ? (
                                <div className="mt-2 flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      respondToInvite(inv.id, "accepted")
                                    }
                                    className="rounded-lg bg-navy-500 px-2.5 py-1 text-2xs font-medium text-white hover:bg-navy-400"
                                  >
                                    수락
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      respondToInvite(inv.id, "declined")
                                    }
                                    className="rounded-lg border border-charcoal-700 px-2.5 py-1 text-2xs text-charcoal-400 hover:text-charcoal-200"
                                  >
                                    거절
                                  </button>
                                </div>
                              ) : (
                                <p className="mt-1 text-2xs text-green-400">
                                  수락함
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
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
        // min-h-0 이 없으면 flex 자식이 콘텐츠 높이만큼 부풀어 스크롤이 안 잡힌다.
        <div className="flex min-h-0 flex-1 flex-col">
          <WeekCalendar
            username={username}
            days={displayWeekDays}
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
        </div>
      )}

      {detailEvent && (
        <EventDetailModal
          item={detailEvent}
          invite={
            detailEvent.id.startsWith(INVITE_PREFIX)
              ? (invites.find(
                  (i) => `${INVITE_PREFIX}${i.id}` === detailEvent.id,
                ) ?? null)
              : null
          }
          onRespond={async (id, status) => {
            await respondToInvite(id, status);
            if (status === "declined") setDetailEvent(null);
          }}
          isCompleted={completed.has(normalizeEventKey(detailEvent.id))}
          canToggleComplete={!!viewerIsOwner}
          onToggleComplete={() => handleToggleComplete(detailEvent.id)}
          onEdit={() => {
            if (detailEvent.kind !== "event") return;
            const parsed = parseWeekItemId(detailEvent.id);
            if (!parsed) return;
            if (parsed.kind === "native") {
              const full = events.find((e) => e.id === parsed.id);
              if (!full) return;
              setDetailEvent(null);
              openEditForm(full);
              return;
            }
            // Google — synthesize an Event-shaped object for the form.
            const nativeCal = myCalendars.find(
              (c) => c.source === "google" && c.google_calendar_id === parsed.gcalId,
            );
            const synthetic: Event = {
              id: `gcal:${parsed.gcalId}::${parsed.eventId}`,
              title: detailEvent.title,
              description: null,
              start_at: detailEvent.start_at,
              end_at: detailEvent.end_at,
              all_day: detailEvent.all_day,
              business_id: null,
              calendar_id: nativeCal?.id ?? null,
              source: "google",
              tentative: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            setDetailEvent(null);
            openEditForm(synthetic);
          }}
          onDelete={async () => {
            if (detailEvent.kind !== "event") return;
            const parsed = parseWeekItemId(detailEvent.id);
            if (!parsed) return;
            const ok = await confirm({
              title: "이 일정을 삭제할까요?",
              body:
                parsed.kind === "google"
                  ? `"${detailEvent.title}" 일정이 Google 캘린더에서도 삭제돼요.`
                  : `"${detailEvent.title}" 일정이 orbit42 에서 사라져요.`,
              confirmLabel: "삭제",
              danger: true,
            });
            if (!ok) return;
            if (parsed.kind === "native") {
              await deleteEvent(parsed.id);
            } else {
              const res = await deleteGoogleEvent(parsed.gcalId, parsed.eventId);
              if ("error" in res) {
                toast.error(res.error);
                return;
              }
            }
            toast.success("삭제했어요.");
            setDetailEvent(null);
            await fetchEvents(year, month);
            router.refresh();
          }}
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
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-base))] p-6 shadow-2xl">
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
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 focus:border-navy-400 focus:outline-none"
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
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 focus:border-navy-400 focus:outline-none resize-none"
                  placeholder="메모 (선택)"
                />
              </div>

              {/* 위치 · 이동시간 (앱과 동일) */}
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-charcoal-400">
                    위치
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, location: e.target.value }))
                    }
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 focus:border-navy-400 focus:outline-none"
                    placeholder="예: 강남 또는 상세 주소"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-charcoal-400">
                    이동시간
                  </label>
                  <select
                    value={form.travelMin}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, travelMin: Number(e.target.value) }))
                    }
                    className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-400 focus:outline-none"
                  >
                    <option value={0}>없음</option>
                    <option value={15}>15분</option>
                    <option value={30}>30분</option>
                    <option value={45}>45분</option>
                    <option value={60}>1시간</option>
                    <option value={90}>1시간 30분</option>
                    <option value={120}>2시간</option>
                  </select>
                </div>
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
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-400 focus:outline-none"
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
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-400 focus:outline-none"
                />
              </div>

              {/* All day toggle */}
              <label className="flex items-center gap-2 text-sm text-charcoal-300">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                  className="h-4 w-4 rounded border-charcoal-700 bg-charcoal-800/50 text-navy-500 focus:ring-navy-400"
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
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-400 focus:outline-none"
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
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 참석자 — 저장된 일정에만. 새 일정은 저장 후 상세에서 추가한다. */}
              {editingEvent && (
                <EventParticipantsPanel
                  eventId={editingEvent.id}
                  title={editingEvent.title}
                  startAt={editingEvent.start_at}
                  endAt={editingEvent.end_at}
                  allDay={editingEvent.all_day}
                />
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
                  className="rounded-lg bg-navy-500 px-4 py-2 text-sm font-medium text-white hover:bg-navy-400 disabled:opacity-50"
                >
                  {isPending ? "저장 중..." : editingEvent ? "수정" : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quickEdit && (
        <QuickEditPopover
          event={quickEdit.event}
          anchor={quickEdit.anchor}
          calendars={myCalendars}
          color={getEventColor(quickEdit.event)}
          onClose={() => setQuickEdit(null)}
          onSaved={async () => {
            setQuickEdit(null);
            await fetchEvents(year, month);
            router.refresh();
          }}
          onOpenFull={() => {
            const ev = quickEdit.event;
            setQuickEdit(null);
            openEditForm(ev);
          }}
          onDeleted={async () => {
            setQuickEdit(null);
            await fetchEvents(year, month);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Quick edit popover (month view) ───────────────────────

function QuickEditPopover({
  event,
  anchor,
  calendars,
  color,
  onClose,
  onSaved,
  onOpenFull,
  onDeleted,
}: {
  event: Event;
  anchor: { x: number; y: number };
  calendars: Calendar[];
  color: string;
  onClose: () => void;
  onSaved: () => void;
  onOpenFull: () => void;
  onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [title, setTitle] = useState(event.title);
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const [pending, setPending] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Position after mount so we can clamp to viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || 280;
    const h = el.offsetHeight || 200;
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.x + 8;
    let top = anchor.y + 8;
    if (left + w + pad > vw) left = Math.max(pad, vw - w - pad);
    if (top + h + pad > vh) top = Math.max(pad, anchor.y - h - 8);
    setPos({ left, top });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, onClose]);

  const isGoogle = event.source === "google";
  const dateLabel = start.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeLabel = event.all_day
    ? "종일"
    : `${start.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })} – ${end.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

  async function handleSave() {
    if (!title.trim() || title === event.title) {
      onClose();
      return;
    }
    setPending(true);
    try {
      if (isGoogle && event.id.startsWith("gcal_")) {
        // The month-view event id is `gcal_${item.id}`. We need the
        // google calendar id to patch — resolve via calendar_id.
        const cal = calendars.find((c) => c.id === event.calendar_id);
        const gcalId = cal?.google_calendar_id;
        const eventId = event.id.slice("gcal_".length);
        if (!gcalId) {
          toast.error("이 Google 일정의 캘린더를 찾지 못했어요.");
          setPending(false);
          return;
        }
        const res = await updateGoogleEvent(gcalId, eventId, {
          title: title.trim(),
        });
        if ("error" in res) {
          toast.error(res.error);
          setPending(false);
          return;
        }
      } else {
        await updateEvent(event.id, { title: title.trim() });
      }
      toast.success("저장했어요.");
      onSaved();
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "이 일정을 삭제할까요?",
      body: isGoogle
        ? `"${event.title}" 일정이 Google 캘린더에서도 삭제돼요.`
        : `"${event.title}" 일정이 orbit42 에서 사라져요.`,
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    setPending(true);
    try {
      if (isGoogle) {
        const cal = calendars.find((c) => c.id === event.calendar_id);
        const gcalId = cal?.google_calendar_id;
        const eventId = event.id.slice("gcal_".length);
        if (!gcalId) {
          toast.error("이 Google 일정의 캘린더를 찾지 못했어요.");
          setPending(false);
          return;
        }
        const res = await deleteGoogleEvent(gcalId, eventId);
        if ("error" in res) {
          toast.error(res.error);
          setPending(false);
          return;
        }
      } else {
        await deleteEvent(event.id);
      }
      toast.success("삭제했어요.");
      onDeleted();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        className="fixed z-50 w-[280px] rounded-xl border border-charcoal-800/70 bg-[rgb(var(--bg-base))] p-4 shadow-2xl"
        style={{
          left: pos?.left ?? anchor.x,
          top: pos?.top ?? anchor.y,
          visibility: pos ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-[7px] inline-block h-3 w-[3px] shrink-0 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-charcoal-100 hover:border-charcoal-800 focus:border-charcoal-700 focus:outline-none"
          />
        </div>
        <div className="mt-3 space-y-1 text-xs text-charcoal-400">
          <p>{dateLabel}</p>
          <p>{timeLabel}</p>
          {isGoogle && (
            <p className="text-2xs text-blue-400/80">Google 캘린더</p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-lg px-2.5 py-1.5 text-xs text-charcoal-500 hover:bg-red-900/30 hover:text-red-400 disabled:opacity-50"
          >
            삭제
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenFull}
              disabled={pending}
              className="rounded-lg px-2.5 py-1.5 text-xs text-charcoal-400 hover:bg-charcoal-800/60 hover:text-charcoal-200 disabled:opacity-50"
            >
              상세
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || !title.trim()}
              className="rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-400 disabled:opacity-50"
            >
              {pending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </>
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
        const isDone = completed.has(normalizeEventKey(ev.id));
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
                  ? "border-navy-400 bg-navy-500 text-white"
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
                  <span className="shrink-0 rounded bg-blue-500/10 px-1 py-0.5 text-2xs text-blue-400">G</span>
                )}
                {ev.tentative && (
                  <span className="shrink-0 rounded border border-dashed border-amber-500/50 px-1 py-0.5 text-2xs text-amber-400">예정</span>
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
                  aria-label="이벤트 수정"
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
                  aria-label="이벤트 삭제"
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
                isCurrentMonth ? "text-navy-400" : "text-charcoal-300"
              }`}
            >
              {MONTH_NAMES[monthIdx]}
            </h3>
            {/* Mini day headers */}
            <div className="grid grid-cols-7 gap-0">
              {DAYS_MON.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-3xs font-medium ${
                    i === 5 ? "text-blue-400/50" : i === 6 ? "text-navy-400/50" : "text-charcoal-600"
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
                          className={`text-3xs leading-none ${
                            isToday
                              ? "flex h-3.5 w-3.5 items-center justify-center rounded-full bg-navy-500 text-white"
                              : "text-charcoal-500"
                          }`}
                        >
                          {day}
                        </span>
                        {hasEvents && !isToday && (
                          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-0.5 rounded-full bg-navy-400" />
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
                isCurrentMonth ? "text-navy-400" : "text-charcoal-300"
              }`}
            >
              {MONTH_NAMES[monthIdx]}
            </h3>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS_MON.map((d, i) => (
                <div
                  key={d}
                  className={`py-1 text-center text-2xs font-medium ${
                    i === 5 ? "text-blue-400/60" : i === 6 ? "text-navy-400/60" : "text-charcoal-600"
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
                    className={`flex h-8 flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                      !day
                        ? "cursor-default"
                        : isToday
                          ? "bg-navy-500/10 cursor-pointer"
                          : "cursor-pointer hover:bg-charcoal-800/50"
                    }`}
                  >
                    {day && (
                      <div className="relative flex items-center justify-center">
                        <span
                          className={`flex h-5 w-5 items-center justify-center text-2xs font-medium ${
                            isToday
                              ? "rounded-full bg-navy-500 text-white"
                              : isSun
                                ? "text-navy-400/70"
                                : isSat
                                  ? "text-blue-400/70"
                                  : "text-charcoal-400"
                          }`}
                        >
                          {day}
                        </span>
                        {dayEvents.length > 0 && !isToday && (
                          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-navy-400" />
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
  invite,
  onRespond,
  isCompleted,
  canToggleComplete,
  onToggleComplete,
  onEdit,
  onDelete,
  onClose,
}: {
  item: WeekItem;
  /** 내가 초대받은 일정일 때만 — 이 경우 수정·삭제 대신 수락/거절을 낸다. */
  invite?: InviteView | null;
  onRespond?: (id: string, status: "accepted" | "declined") => void;
  isCompleted: boolean;
  canToggleComplete: boolean;
  onToggleComplete: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  if (item.kind !== "event") return null;
  const isInvite = !!invite;
  // Week items identify native vs google by id prefix.
  // native: "native:<uuid>", google: "<gcal_id>::<event_id>"
  const isNative = item.id.startsWith("native:");
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
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5 shadow-2xl"
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
            {isInvite ? (
              <p className="mt-2 text-2xs text-purple-300">
                {invite?.inviterName ?? "누군가"}님이 초대한 일정이에요.
                {invite?.status === "accepted" ? " 수락함." : ""}
              </p>
            ) : (
              !isNative &&
              canToggleComplete && (
                <p className="mt-2 text-2xs text-charcoal-600">
                  Google 캘린더 일정 — 여기서 수정하면 Google 쪽에도 함께 반영돼요.
                </p>
              )
            )}
          </div>
        </div>

        {canToggleComplete && !isInvite && (
          <>
            <EventAssetPanel
              eventId={item.id}
              title={item.title}
              startAt={item.start_at}
              endAt={item.end_at}
              allDay={item.all_day}
            />
            <EventParticipantsPanel
              eventId={item.id}
              title={item.title}
              startAt={item.start_at}
              endAt={item.end_at}
              allDay={item.all_day}
            />
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isInvite && invite && (
              <>
                {invite.status === "invited" && (
                  <button
                    type="button"
                    onClick={() => onRespond?.(invite.id, "accepted")}
                    className="rounded-lg bg-navy-500 px-3 py-2 text-sm font-medium text-white hover:bg-navy-400"
                  >
                    수락
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRespond?.(invite.id, "declined")}
                  className="rounded-lg border border-charcoal-700 px-3 py-2 text-sm text-charcoal-300 hover:border-charcoal-600 hover:bg-charcoal-800/60"
                >
                  거절
                </button>
              </>
            )}
            {!isInvite && canToggleComplete && (
              <button
                type="button"
                onClick={onToggleComplete}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isCompleted
                    ? "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                    : "bg-navy-500 text-white hover:bg-navy-400"
                }`}
              >
                {isCompleted ? "완료 취소" : "완료로 표시"}
              </button>
            )}
            {!isInvite && canToggleComplete && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-charcoal-700 px-3 py-2 text-sm text-charcoal-200 hover:border-charcoal-600 hover:bg-charcoal-800/60"
              >
                수정
              </button>
            )}
            {!isInvite && canToggleComplete && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                삭제
              </button>
            )}
          </div>
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

