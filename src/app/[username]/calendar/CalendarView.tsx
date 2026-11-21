"use client";

import {
  saturdayIndex,
  sundayIndex,
  weekdayIndex,
  weekdayLabels,
  type WeekStart,
} from "@/lib/week-start";
import { EventAssetPanel } from "./EventAssetPanel";
import {
  EventParticipantsPanel,
  PendingParticipantsPanel,
  type PendingParticipant,
} from "./EventParticipantsPanel";
import { useState, useTransition, useCallback, useMemo, useEffect, useRef } from "react";
import { getCompletedKeys, toggleEventCompletion } from "@/lib/event-completions-actions";
import { useHorizontalSwipe } from "@/lib/use-horizontal-swipe";
import { normalizeEventKey, toEventKey } from "@/lib/event-key";
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
  addEventParticipant,
} from "./actions";
import LifeCalendarViewExternal from "./LifeCalendarView";
import type { LifeMemory } from "./life-actions";
import { WeekCalendar } from "@/components/WeekCalendar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { AfterCompletionSheet, ASK_FOLLOW_UP_KEY, DayTodoStrip, FollowUpSection, Hearts, RatingRow } from "./EventFollowUps";
import { myRatings, setMyRating } from "@/lib/annotation-actions";
import { linkFollowUpEvent } from "@/lib/todos-actions";
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


type ViewMode = "life" | "year" | "quarter" | "month" | "week" | "day";
const VIEW_KEY = "orbit42.calendarView";
const VIEW_MODES: ViewMode[] = ["life", "year", "quarter", "month", "week", "day"];
const isPhone = () => window.matchMedia("(max-width: 767px)").matches;
/** 휴대폰에서 달을 옮길 때 고를 날 — 이번 달이면 오늘, 아니면 1일. 데스크톱은 예전처럼 비움(null). */
function phoneDefaultDay(y: number, m: number): number | null {
  if (typeof window === "undefined" || !isPhone()) return null;
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m ? t.getDate() : 1;
}

/** ISO 8601 week number (Monday-start) */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** 한 달 격자 — 앞쪽 빈칸은 주 시작 요일(설정)에 따라 달라진다. Returns (number|null)[] */
function getCalendarDays(year: number, month: number, ws: WeekStart = "mon") {
  const offset = weekdayIndex(new Date(year, month, 1), ws);
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

function getWeekDates(year: number, month: number, day: number, ws: WeekStart = "mon") {
  const date = new Date(year, month, day);
  const monday = new Date(year, month, day - weekdayIndex(date, ws));
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
  weekStart = "mon",
  todoCount = 0,
  unreadNotifications = 0,
}: {
  /** 휴대폰 도구 줄 '할 일' 배지(오늘 기한 + 지난 미완료) */
  todoCount?: number;
  /** 휴대폰 도구 줄 알림 배지 — 캘린더에서는 공통 제목 줄을 숨기고 이 줄이 알림을 가진다 */
  unreadNotifications?: number;
  /** 주 시작 요일 — 보는 사람의 설정 */
  weekStart?: WeekStart;
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
  // iOS 앱처럼 오늘이 선택된 채로 시작해 아래에 오늘 일정이 바로 보인다.
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // 서버(UTC)와 브라우저의 '오늘'이 다를 수 있어 마운트 후에 고른다 (hydration 불일치 방지).
  useEffect(() => {
    const now = new Date();
    if (now.getFullYear() === initialYear && now.getMonth() === initialMonth) setSelectedDay(now.getDate());
  }, [initialYear, initialMonth]);
  const [showForm, setShowForm] = useState(false);
  // 일정 추가는 제목·시간만 먼저. 메모·위치·참석자·캘린더는 '더 보기'에서.
  const [moreOpen, setMoreOpen] = useState(false);
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
  // 새 일정은 event_key 가 없어 참석자를 바로 못 붙인다. 담아 뒀다가 저장
  // 직후 초대한다 (iOS 새 일정 시트와 같은 방식).
  const [pendingParticipants, setPendingParticipants] = useState<
    PendingParticipant[]
  >([]);
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
    if (eventId.startsWith(INVITE_PREFIX)) return false;
    const key = normalizeEventKey(eventId);
    const isDone = completed.has(key);
    // Optimistic update.
    setCompleted((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(key);
      else next.add(key);
      return next;
    });
    let res: Awaited<ReturnType<typeof toggleEventCompletion>>;
    try {
      res = await toggleEventCompletion(key, !isDone);
    } catch {
      res = { error: "완료 상태를 저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
    }
    if ("error" in res) {
      toast.error(res.error ?? "완료 상태를 저장하지 못했어요.");
      // Roll back.
      setCompleted((prev) => {
        const next = new Set(prev);
        if (isDone) next.add(key);
        else next.delete(key);
        return next;
      });
      return false;
    }
    return true;
  }, [completed, toast]);

  // ── 만족도·후속(웹 묶음 1b, iOS 와 같은 흐름) ──
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [afterDone, setAfterDone] = useState<{ id: string; title: string } | null>(null);
  const [ratePrompt, setRatePrompt] = useState<{ id: string; title: string } | null>(null);
  const [followUpSource, setFollowUpSource] = useState<string | null>(null);
  const [followUpRefresh, setFollowUpRefresh] = useState(0);
  const rateOf = (id: string) => ratings[toEventKey(id)] ?? null;
  const setRatingLocal = useCallback((id: string, v: number | null) => {
    const k = toEventKey(id);
    setRatings((r) => {
      const n = { ...r };
      if (v == null) delete n[k];
      else n[k] = v;
      return n;
    });
  }, []);
  const rate = useCallback(async (id: string, v: number | null) => {
    const prev = ratings[toEventKey(id)] ?? null;
    setRatingLocal(id, v);
    // 저장 실패(오류 응답·네트워크 끊김)면 화면을 되돌리고 알린다 — 하트만 바뀌고 저장 안 된 채로 두지 않는다(11/21)
    let failed: string | null = null;
    try {
      const res = await setMyRating(id, v);
      if ("error" in res) failed = res.error;
    } catch {
      failed = "만족도를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
    }
    if (failed) {
      setRatingLocal(id, prev);
      toast.error(failed);
    }
  }, [toast, setRatingLocal, ratings]);
  const askFollowUp = () => {
    try {
      return localStorage.getItem(ASK_FOLLOW_UP_KEY) !== "0";
    } catch {
      return true;
    }
  };
  // 목록·격자에서 체크 → iOS 하루 보기처럼 잠깐 만족도 하트 줄
  const completeFromList = useCallback(async (id: string) => {
    const wasDone = completed.has(normalizeEventKey(id));
    // 하트 줄은 체크와 동시에 이 일정으로 바꿔 띄운다 — 저장 응답을 기다리면 그사이 앞 일정의 하트 줄이 남아
    // 빠르게 이어 누른 하트가 앞 일정에 매겨졌다(11/21 실측). 저장이 실패하면 이 일정의 하트 줄만 닫는다.
    const ask = !wasDone && viewerIsOwner && !id.startsWith(INVITE_PREFIX);
    if (ask) {
      const title =
        events.find((e) => toEventKey(e.id) === toEventKey(id))?.title ??
        weekDays.flatMap((d) => d.items).find((i) => toEventKey(i.id) === toEventKey(id))?.title ??
        "";
      setRatePrompt({ id, title });
    } else {
      setRatePrompt((cur) => (cur?.id === id ? null : cur));
    }
    const ok = await handleToggleComplete(id);
    if (!ok && ask) setRatePrompt((cur) => (cur?.id === id ? null : cur));
  }, [completed, handleToggleComplete, viewerIsOwner, events, weekDays]);
  useEffect(() => {
    if (!viewerIsOwner) return;
    const ids = [
      ...events.map((e) => e.id),
      ...weekDays.flatMap((d) => d.items.filter((i) => i.kind === "event").map((i) => i.id)),
    ];
    if (ids.length === 0) return;
    let cancelled = false;
    myRatings(Array.from(new Set(ids.map(toEventKey))).slice(0, 1000)).then((r) => {
      if (!cancelled) setRatings(r);
    });
    return () => {
      cancelled = true;
    };
  }, [events, weekDays, viewerIsOwner]);
  useEffect(() => {
    if (!ratePrompt) return;
    const t = setTimeout(() => setRatePrompt(null), 4000);
    return () => clearTimeout(t);
  }, [ratePrompt]);

  const refetchWeekDays = useCallback(
    (anchor: Date, cals?: string[]) => {
      // Monday of the week containing the anchor date
      const a = new Date(anchor);
      a.setHours(0, 0, 0, 0);
      a.setDate(a.getDate() - weekdayIndex(a, weekStart));
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
    [username, selectedCalendars, weekStart],
  );

  const today = useMemo(() => new Date(), []);
  // 일정을 만들고·고치고·지운 뒤 주·하루 보기 격자도 다시 받는다. weekDays 는 처음 서버 값으로만
  // 채워지고 router.refresh() 로는 바뀌지 않아, 새 일정이 격자에 안 보였다(TWA 점검 11/20).
  const refreshWeek = () => refetchWeekDays(new Date(year, month, selectedDay ?? today.getDate()));
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const days = getCalendarDays(year, month, weekStart);


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
      // 휴대폰은 iOS 처럼 늘 한 날을 골라 둔다(이번 달이면 오늘, 아니면 1일) — 아래 목록이 비지 않게
      setSelectedDay(phoneDefaultDay(newYear, newMonth));
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

  // 하루 보기(휴대폰): 하루씩. 주가 바뀌면 주 띠·격자용 weekDays 를 다시 받는다.
  const goToDate = useCallback(
    (d: Date) => {
      const inWeek = weekDays.some((w) => isSameDay(new Date(w.date), d));
      if (d.getFullYear() !== year || d.getMonth() !== month) fetchEvents(d.getFullYear(), d.getMonth());
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDay(d.getDate());
      if (!inWeek) refetchWeekDays(d);
    },
    [weekDays, year, month, fetchEvents, refetchWeekDays],
  );

  const navigateDay = useCallback(
    (dir: -1 | 1) => {
      const d = new Date(year, month, selectedDay ?? today.getDate());
      d.setDate(d.getDate() + dir);
      goToDate(d);
    },
    [year, month, selectedDay, today, goToDate],
  );

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (viewMode === "day") navigateDay(dir);
      else if (viewMode === "month") navigateMonth(dir);
      else if (viewMode === "week") navigateWeek(dir);
      else if (viewMode === "quarter") navigateQuarter(dir);
      else navigateYear(dir);
    },
    [viewMode, navigateDay, navigateMonth, navigateWeek, navigateQuarter, navigateYear],
  );

  // 휴대폰 좌우 밀기(11/21 Leo, iOS 같게): 시간축·날짜 목록 = 하루, 주 띠 = 한 주, 월 달력 = 한 달. PC 는 훅이 아무것도 안 한다.
  const swipeDay = useHorizontalSwipe((d) => navigateDay(d));
  const swipeDayCard = useHorizontalSwipe((d) => navigateDay(d));
  const swipeWeekStrip = useHorizontalSwipe((d) => {
    const x = new Date(year, month, (selectedDay ?? today.getDate()) + 7 * d);
    goToDate(x);
  });
  const swipeMonth = useHorizontalSwipe((d) => navigateMonth(d));

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
      if (viewMode === "week" || viewMode === "day") {
        refetchWeekDays(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
      }
    }
  }, [viewMode, fetchEvents, fetchMultiMonthEvents, refetchWeekDays]);

  const switchView = useCallback(
    (mode: ViewMode, save = true) => {
      setViewMode(mode);
      // 고른 보기를 기억한다 — 다음에 열 때 기기 기본값보다 먼저(묶음 B)
      if (save && (!isPhone() || mode === "month" || mode === "day")) {
        try {
          localStorage.setItem(VIEW_KEY, mode);
        } catch {}
      }
      if (mode === "year") {
        fetchMultiMonthEvents(year, Array.from({ length: 12 }, (_, i) => i));
      } else if (mode === "quarter") {
        const q = getQuarterForMonth(month);
        setQuarter(q);
        fetchMultiMonthEvents(year, getQuarterMonths(q));
      } else if (mode === "week" || mode === "day") {
        if (!selectedDay) setSelectedDay(today.getDate());
        fetchEvents(year, month);
        refetchWeekDays(new Date(year, month, selectedDay ?? today.getDate()));
      } else {
        fetchEvents(year, month);
      }
    },
    [year, month, today, selectedDay, fetchEvents, fetchMultiMonthEvents, refetchWeekDays],
  );

  // 처음 보기: 저장한 보기가 있으면 그것, 없으면 휴대폰은 iOS 처럼 하루 보기(시간축 + 주 띠),
  // 데스크톱은 주 보기 그대로. 하루 보기는 데스크톱에서도 고를 수 있다(11/21 PO).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(VIEW_KEY);
    } catch {}
    const phone = isPhone();
    let mode: ViewMode | null = VIEW_MODES.includes(saved as ViewMode) ? (saved as ViewMode) : null;
    // 휴대폰은 iOS 처럼 월/하루만 기억하고 기본은 월(PO 11/21). 라이프·분기는 휴대폰에서 숨김(Leo).
    if (phone && mode !== "month" && mode !== "day") mode = null;
    // 라이프·분기는 숨긴 보기 — 예전에 저장해 둔 값이면 월로(PC 도, Leo 11/21)
    if (mode === "life" || mode === "quarter") mode = "month";
    if (!mode) mode = phone ? "month" : "week";
    if (mode !== "week") switchView(mode, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** 월 보기 목록의 일정 → 주간 상세와 같은 상세 창 입력. 구글 일정은 캘린더를 못 찾으면 null */
  const eventToWeekItem = useCallback(
    (ev: Event): WeekItem | null => {
      let id: string;
      if (ev.source === "google") {
        const gcal = myCalendars.find((c) => c.id === ev.calendar_id)?.google_calendar_id;
        if (!gcal) return null;
        id = `${gcal}::${ev.id.startsWith("gcal_") ? ev.id.slice(5) : ev.id}`;
      } else {
        id = `native:${ev.id}`;
      }
      return {
        kind: "event",
        id,
        start_at: ev.start_at,
        end_at: ev.end_at,
        all_day: ev.all_day,
        title: ev.title,
        color: getEventColor(ev),
        tentative: !!ev.tentative,
        travel_min: ev.travel_min ?? null,
      };
    },
    [myCalendars, getEventColor],
  );

  // 휴대폰: 날짜를 고르면 그날 목록이 달력 아래(첫 화면 밖)에 붙으므로 그 목록까지 내려 준다
  const dayListRef = useRef<HTMLDivElement>(null);
  const pickMonthDay = (day: number) => {
    const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    // 휴대폰: iOS 처럼 고른 날을 다시 누르면 주 보기(주 띠 + 목록)로
    if (phone && day === selectedDay) {
      switchView("week");
      return;
    }
    const next = !phone && day === selectedDay ? null : day;
    setSelectedDay(next);
    if (next && phone) {
      requestAnimationFrame(() =>
        dayListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  // ── Form ──

  const openCreateForm = (day?: number, forYear?: number, forMonth?: number) => {
    const y = forYear ?? year;
    const m = forMonth ?? month;
    const dateStr = day
      ? toLocalDateStr(y, m, day)
      : toLocalDateStr(y, m, selectedDay ?? today.getDate());
    setEditingEvent(null);
    setForm(emptyForm(dateStr, defaultCalendarId));
    setPendingParticipants([]);
    setMoreOpen(false);
    setShowForm(true);
  };

  /** 주간 뷰 빈 칸 → 그 시각부터 1시간짜리 새 일정 */
  const openCreateAt = (date: Date, hour: number, minute: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const endMin = Math.min(hour * 60 + minute + 60, 23 * 60 + 59);
    setEditingEvent(null);
    setForm({
      ...emptyForm(toLocalDateStr(date.getFullYear(), date.getMonth(), date.getDate()), defaultCalendarId),
      startTime: `${pad(hour)}:${pad(minute)}`,
      endTime: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`,
    });
    setPendingParticipants([]);
    setMoreOpen(false);
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
      location: event.location ?? "",
      travelMin: event.travel_min ?? 0,
    });
    // 수정할 때는 이미 적어 둔 내용이 보이도록 펼친다.
    setMoreOpen(!!(event.description || event.location));
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setPendingParticipants([]);
    setFollowUpSource(null);
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
        const created = await createEvent(input);
        // [후속 일정]으로 연 폼이면 원래 일정의 후속으로 잇는다
        if (followUpSource) {
          const linked = await linkFollowUpEvent(followUpSource, created.id);
          if ("error" in linked) toast.error(linked.error);
          setFollowUpSource(null);
          setFollowUpRefresh((n) => n + 1);
        }
        const failed = await invitePending(created);
        if (failed.length > 0) {
          // 일정은 살아 있다. 저장된 일정 모드로 넘겨, 붙은 사람은 그대로 두고
          // 실패한 사람만 다시 추가하게 한다.
          const data = await getEvents(year, month, selectedCalendars);
          setEvents(data);
          router.refresh();
          refreshWeek();
          setEditingEvent(created);
          setPendingParticipants([]);
          toast.error(
            `일정은 저장했지만 ${failed.length}명을 초대하지 못했어요. 아래에서 다시 추가해주세요.`,
          );
          return;
        }
      }
      const data = await getEvents(year, month, selectedCalendars);
      setEvents(data);
      // Also refresh week view data so the detail modal reflects latest.
      router.refresh();
      refreshWeek();
      closeForm();
    });
  };

  /** 담아 둔 참석자를 새로 만든 일정에 초대하고, 실패한 사람만 돌려준다. */
  const invitePending = async (created: Event) => {
    if (pendingParticipants.length === 0) return [];
    const snapshot = {
      title: created.title,
      startAt: created.start_at,
      endAt: created.end_at,
      allDay: created.all_day,
      location: created.location ?? null,
      description: created.description ?? null,
    };
    const failed: PendingParticipant[] = [];
    for (const p of pendingParticipants) {
      const res = await addEventParticipant(
        // 구글 캘린더에 만든 일정은 `gcal_<id>` 로 돌아온다 — 참석자 키와 같은 형식.
        toEventKey(created.id),
        snapshot,
        p.kind === "user" ? { username: p.username } : { email: p.email },
      );
      if ("error" in res) failed.push(p);
    }
    return failed;
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
    if (viewMode === "day") {
      const d = new Date(year, month, selectedDay ?? today.getDate());
      return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
    }
    if (viewMode === "week") {
      const weekDates = getWeekDates(year, month, selectedDay ?? today.getDate(), weekStart);
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
    if (viewMode === "day") return isSameDay(new Date(year, month, selectedDay ?? t.getDate()), t);
    // week
    const weekDates = getWeekDates(year, month, selectedDay ?? today.getDate(), weekStart);
    return weekDates.some(
      (d) => d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate(),
    );
  };

  // ── Render ──

  const viewTabs = (
    <div className="flex shrink-0 overflow-x-auto rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-0.5">
      {(
        [
          // 라이프·분기는 PC 에서도 숨긴다(Leo 11/21 "필요 없는 것 같아, 숨겨") — 코드·데이터는 그대로
          ["year", "연"],
          ["month", "월"],
          ["week", "주"],
          ["day", "일"],
        ] as const
      ).map(([mode, label]) => (
        <button
          key={mode}
          onClick={() => switchView(mode)}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors max-md:min-h-11 max-md:min-w-11 ${
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

  // 주 띠(요일·날짜·일정 점) — 휴대폰 하루·주 보기 위(iOS 와 같게)
  const renderWeekStrip = (sel: Date) => (
            <div ref={swipeWeekStrip} className="grid grid-cols-7 gap-1 max-md:touch-pan-y" role="tablist" aria-label="이번 주" data-testid="weekStrip">
              {displayWeekDays.map((d) => {
                const date = new Date(d.date);
                const active = isSameDay(date, sel);
                const has = d.items.length > 0;
                const dow = date.getDay();
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
                    onClick={() => goToDate(date)}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition-colors ${
                      active ? "bg-navy-500 text-white" : "text-charcoal-200 hover:bg-charcoal-800/40"
                    }`}
                  >
                    <span className={`text-xs ${active ? "text-white/80" : dow === 0 ? "text-red-500" : "text-charcoal-500"}`}>
                      {date.toLocaleDateString("ko-KR", { weekday: "short" })}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        !active && d.isToday ? "inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-navy-400" : ""
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <span className={`h-1 w-1 rounded-full ${has ? (active ? "bg-white" : "bg-navy-400") : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
  );

  // 고른 날의 일정 목록 — 월 보기 옆(데스크톱)·아래(휴대폰), 휴대폰 주 보기(주 띠 + 목록)에서 같이 쓴다
  const selectedDayCard = (
            <div ref={swipeDayCard} data-testid="dayCard" className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5 max-md:touch-pan-y max-md:rounded-2xl max-md:p-4">
              {selectedDay ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-charcoal-200">
                      {month + 1}월 {selectedDay}일
                    </h3>
                    <button
                      onClick={() => openCreateForm(selectedDay)}
                      className="rounded-lg bg-navy-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-400 max-md:min-h-11 max-md:px-3.5"
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
                          onOpen={(ev) => {
                            const item = eventToWeekItem(ev);
                            if (item) setDetailEvent(item);
                            else if (ev.source !== "google") openEditForm(ev);
                          }}
                          onEdit={openEditForm}
                          onDelete={handleDelete}
                          completed={completed}
                          ratings={ratings}
                          onToggleComplete={completeFromList}
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
  );

  // 날짜 이동 — 예전엔 툴바 아래 별도 줄이었다. 한 줄로 합쳐 캘린더에 높이를 넘긴다.
  const dateNav = (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(-1)}
        aria-label="이전"
        className="inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-sm text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-200 max-md:-mx-1.5 max-md:h-11 max-md:w-11"
      >
        &larr;
      </button>
      <h2 className="min-w-[128px] text-center text-base font-semibold text-charcoal-200 sm:min-w-[150px] sm:text-lg">
        {getHeaderLabel()}
      </h2>
      <button
        onClick={() => navigate(1)}
        aria-label="다음"
        className="inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-sm text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-200 max-md:-mx-1.5 max-md:h-11 max-md:w-11"
      >
        &rarr;
      </button>
      {!isViewCurrent() && (
        <button
          onClick={goToToday}
          className="ml-1 rounded-lg bg-charcoal-800/60 px-2.5 py-1 text-xs text-charcoal-400 hover:text-charcoal-200 max-md:min-h-11"
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
      <div className="flex flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:gap-1 sm:gap-3">
        <div className="hidden sm:block">{viewTabs}</div>
        {viewMode !== "life" && <div className="max-sm:hidden">{dateNav}</div>}
        {/* 휴대폰 머리(iOS 와 같게, PO 11/21): [오늘] … [필터][할 일][월/하루][+] */}
        <button
          type="button"
          onClick={goToToday}
          className="h-11 shrink-0 rounded-full bg-charcoal-800/50 px-3 text-sm font-medium text-charcoal-200 sm:hidden"
        >
          오늘
        </button>
        <h1 className="min-w-0 truncate text-title font-semibold text-charcoal-50 sm:hidden">캘린더</h1>
        <div className="ml-auto flex items-center gap-2 max-sm:gap-0 sm:gap-3">
          {myCalendars.length > 0 ? (
            <div className="relative">
              <button
                onClick={() => setShowCalendarPicker(!showCalendarPicker)}
                aria-label="캘린더 고르기"
                className="flex items-center gap-1.5 rounded-lg border border-charcoal-800 bg-charcoal-900/40 px-3 py-2 text-xs font-medium text-charcoal-200 hover:border-charcoal-700 max-md:min-h-11 max-sm:h-11 max-sm:w-11 max-sm:justify-center max-sm:border-0 max-sm:bg-transparent max-sm:px-0"
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
                <svg className="h-3 w-3 max-sm:hidden" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
          {viewerIsOwner && (
            <a
              href={`/${username}/todos`}
              aria-label={todoCount > 0 ? `할 일 ${todoCount}개` : "할 일"}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-charcoal-300 hover:bg-charcoal-800/50 sm:hidden"
            >
              {todoCount > 0 && (
                <span className="absolute right-1 top-1.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white" aria-hidden>
                  {todoCount > 99 ? "99+" : todoCount}
                </span>
              )}
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75h11.25M9 12h11.25M9 17.25h11.25M3.75 6.75l1 1 2-2M3.75 12l1 1 2-2M3.75 17.25l1 1 2-2" />
              </svg>
            </a>
          )}
          <button
            type="button"
            onClick={() => switchView(viewMode === "day" ? "month" : "day")}
            aria-label={viewMode === "day" ? "월 보기" : "하루 보기"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-charcoal-300 hover:bg-charcoal-800/50 sm:hidden"
          >
            {viewMode === "day" ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5M3.75 6v12A2.25 2.25 0 0 0 6 20.25h12A2.25 2.25 0 0 0 20.25 18V6M8.25 10.5h7.5M8.25 14.25h4.5" />
              </svg>
            )}
          </button>
          <button
            onClick={() => openCreateForm()}
            aria-label="새 일정"
            className="rounded-lg bg-navy-500 px-3 py-2 text-sm font-medium text-white hover:bg-navy-400 max-md:h-11 max-md:min-w-11 max-sm:inline-flex max-sm:w-11 max-sm:items-center max-sm:justify-center max-sm:bg-transparent max-sm:px-0 max-sm:text-navy-500 sm:px-4"
          >
            <svg className="h-6 w-6 sm:hidden" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">+ 새 일정</span>
          </button>
          <div className="sm:hidden">
            <NotificationBell initialUnread={unreadNotifications} />
          </div>
        </div>
      </div>

      {/* 휴대폰 날짜 줄(iOS): 월 '‹ 2026년 · 2026년 11월 · ‹ ›', 하루·주 '‹ 11월 · 11월 21일 (토) · ‹ ›'.
          왼쪽 '‹ 2026년'은 연 보기, '‹ 11월'은 월 보기로 올라간다. 탭 줄은 없다. */}
      {viewMode !== "life" && viewMode !== "quarter" && (
        <div className="-my-2 flex items-center gap-1 sm:hidden" data-testid="phoneDateRow">
          <div className="w-20 shrink-0">
            {(viewMode === "month" || viewMode === "day" || viewMode === "week") && (
              <button
                type="button"
                onClick={() => switchView(viewMode === "month" ? "year" : "month")}
                aria-label={viewMode === "month" ? "연간 보기" : "월 보기로"}
                className="flex h-11 items-center gap-0.5 text-sm font-medium text-navy-500"
              >
                <span aria-hidden>‹</span>
                {viewMode === "month" ? `${year}년` : `${month + 1}월`}
              </button>
            )}
          </div>
          <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-charcoal-100">
            {viewMode === "week"
              ? (() => {
                  // iOS: '11월 16일 ~ 11월 22일'
                  const wd = getWeekDates(year, month, selectedDay ?? today.getDate(), weekStart);
                  const f = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
                  return `${f(wd[0])} ~ ${f(wd[6])}`;
                })()
              : getHeaderLabel()}
          </h2>
          <div className="flex w-20 shrink-0 justify-end">
            <button type="button" onClick={() => navigate(-1)} aria-label="이전" className="inline-flex h-11 w-10 items-center justify-center text-lg text-navy-500">
              ‹
            </button>
            <button type="button" onClick={() => navigate(1)} aria-label="다음" className="inline-flex h-11 w-10 items-center justify-center text-lg text-navy-500">
              ›
            </button>
          </div>
        </div>
      )}

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
          {/* 모바일은 iOS 처럼 촘촘한 월 달력(주차·제목 없이 점) + 아래 선택한 날 목록 */}
          <div ref={swipeMonth} data-testid="monthGrid" className="rounded-2xl bg-[rgb(var(--bg-surface))] p-2 max-md:touch-pan-y md:rounded-xl md:border md:border-charcoal-800/60 md:bg-charcoal-900/40 md:p-5 max-md:rounded-2xl">
            {/* Day headers with week number column */}
            <div className="grid grid-cols-7 gap-0.5 md:grid-cols-[2rem_repeat(7,minmax(0,1fr))] md:gap-1">
              <div className="py-2 text-center text-2xs font-medium text-charcoal-600 max-md:hidden">W</div>
              {weekdayLabels(weekStart).map((d, i) => (
                <div
                  key={d}
                  className={`py-2 text-center text-xs font-medium ${
                    i === saturdayIndex(weekStart) ? "text-blue-600 dark:text-blue-400" : i === sundayIndex(weekStart) ? "text-red-600 dark:text-red-400" : "text-charcoal-500"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Date cells with week numbers */}
            <div className="grid grid-cols-7 gap-0.5 md:grid-cols-[2rem_repeat(7,minmax(0,1fr))] md:gap-1">
              {days.map((day, i) => {
                const isToday = isCurrentMonth && day === today.getDate();
                const isSelected = day === selectedDay;
                const dayEvents = day ? eventsForCurrentDay(day) : [];
                const dayInvites = day ? invitesForDay(year, month, day) : [];
                const colIdx = i % 7;
                const isSaturday = colIdx === saturdayIndex(weekStart);
                const isSunday = colIdx === sundayIndex(weekStart);

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
                      <div key={`w${i}`} className="flex h-14 items-start justify-center pt-1 max-md:hidden md:h-20 md:pt-2">
                        <span className="text-2xs font-medium text-charcoal-600">
                          {weekNum}
                        </span>
                      </div>
                    )}
                    <div
                      key={i}
                      role={day ? "button" : undefined}
                      tabIndex={day ? 0 : undefined}
                      onClick={() => day && pickMonthDay(day)}
                      onKeyDown={(e) => {
                        if (!day) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          pickMonthDay(day);
                        }
                      }}
                      className={`flex h-14 flex-col items-center rounded-lg p-1 text-left text-sm transition-colors md:h-28 md:items-stretch md:p-1.5 ${
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
                                  ? "text-red-600 dark:text-red-400"
                                  : isSaturday
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-charcoal-300"
                            }`}
                          >
                            {day}
                          </span>
                          {(dayEvents.length > 0 || dayInvites.length > 0) && (
                            <div className="mt-1 flex gap-[3px] md:hidden">
                              {dayEvents.slice(0, 3).map((ev) => (
                                <span key={ev.id} className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: getEventColor(ev) }} />
                              ))}
                              {dayEvents.length === 0 && dayInvites.length > 0 && (
                                <span className="h-[5px] w-[5px] rounded-full bg-amber-500" />
                              )}
                            </div>
                          )}
                          {(dayEvents.length > 0 || dayInvites.length > 0) && (
                            <div className="mt-1 flex min-h-0 flex-1 flex-col gap-[2px] overflow-hidden max-md:hidden">
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
          <div ref={dayListRef} className="space-y-4 max-md:scroll-mt-16">
            {selectedDayCard}
          </div>
        </div>
      )}

      {viewMode === "week" && (
        // 휴대폰 주 보기는 iOS 처럼 시간 격자 없이 '주 띠 + 그날 목록'(PO 11/21). 격자는 데스크톱 전용.
        <div className="space-y-3 md:hidden" data-testid="phoneWeek">
          {renderWeekStrip(new Date(year, month, selectedDay ?? today.getDate()))}
          {selectedDayCard}
        </div>
      )}

      {viewMode === "week" && (
        // min-h-0 이 없으면 flex 자식이 콘텐츠 높이만큼 부풀어 스크롤이 안 잡힌다.
        <div className="flex min-h-0 flex-1 flex-col max-md:hidden">
          <WeekCalendar
            username={username}
            days={displayWeekDays}
            viewerIsOwner={viewerIsOwner}
            completedKeys={completed}
            ratings={ratings}
            onToggleComplete={completeFromList}
            onEventClick={(item) => setDetailEvent(item)}
            onEmptyClick={
              viewerIsOwner
                ? (date, h, m) => openCreateAt(date, h, m)
                : undefined
            }
            emptyMessage={
              viewerIsOwner
                ? "이 주가 비어 있어요. 예약 링크를 열거나 일정을 추가해 보세요."
                : "이 주에 공개된 일정이나 예약 가능한 시간이 없어요."
            }
          />
        </div>
      )}

      {viewMode === "day" && (() => {
        // 휴대폰 하루 보기(묶음 B): 위에 그 주 띠(요일·날짜·일정 점), 아래 하루 시간축.
        // 높이를 '최소'가 아니라 정해 둬야 시간축이 안에서 스크롤되고 8시부터 열린다 — 휴대폰 AppShell 이
        // 내용만큼 늘어나게 바뀐(묶음 2) 뒤 최소 높이만 주면 24시간이 통째로 펼쳐졌다.
        const sel = new Date(year, month, selectedDay ?? today.getDate());
        const dayData = displayWeekDays.find((d) => isSameDay(new Date(d.date), sel));
        const dayOnly: WeekDay[] = [dayData ?? { date: sel, isToday: isSameDay(sel, new Date()), items: [] }];
        return (
          // 데스크톱(11/21): 주 띠 아래 왼쪽 시간축 · 오른쪽 하루 할 일. 그날 일정 목록은 시간축과 겹쳐 따로 두지 않는다.
          <div className="flex h-[calc(100dvh-200px)] min-h-[420px] flex-col gap-2 md:h-auto md:min-h-0 md:flex-1 md:gap-3" data-testid="dayView">
            {renderWeekStrip(sel)}
            <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row md:gap-4">
            {viewerIsOwner && (
              <div className="md:order-last md:w-80 md:shrink-0">
                <DayTodoStrip date={`${sel.getFullYear()}-${String(sel.getMonth() + 1).padStart(2, "0")}-${String(sel.getDate()).padStart(2, "0")}`} />
              </div>
            )}
            <div ref={swipeDay} data-testid="dayTimeline" className="flex min-h-0 flex-1 flex-col max-md:touch-pan-y">
            <WeekCalendar
              username={username}
              days={dayOnly}
              viewerIsOwner={viewerIsOwner}
              completedKeys={completed}
              ratings={ratings}
              onToggleComplete={completeFromList}
              onEventClick={(item) => setDetailEvent(item)}
              onEmptyClick={viewerIsOwner ? (date, h, m) => openCreateAt(date, h, m) : undefined}
              emptyMessage={viewerIsOwner ? "이날은 일정이 없어요. 빈 시간을 누르면 일정을 만들 수 있어요." : "이날 공개된 일정이나 예약 가능한 시간이 없어요."}
            />
            </div>
            </div>
          </div>
        );
      })()}

      {afterDone && (
        <AfterCompletionSheet
          eventId={afterDone.id}
          title={afterDone.title}
          onClose={(n) => {
            setAfterDone(null);
            if (n > 0) setFollowUpRefresh((x) => x + 1);
          }}
          onNewFollowUpEvent={() => {
            setFollowUpSource(afterDone.id);
            setAfterDone(null);
            setDetailEvent(null);
            openCreateForm();
          }}
        />
      )}

      {ratePrompt && (
        // iOS 하루 보기: 체크하면 블록 위에 하트 줄이 잠깐 — 웹은 탭 막대 위에 띄운다
        <div
          role="dialog"
          aria-label="만족도"
          data-testid="ratePrompt"
          className="fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] py-1 pl-4 pr-2 shadow-2xl md:bottom-8"
        >
          <span className="max-w-[8rem] truncate text-sm text-charcoal-300">{ratePrompt.title || "만족도"}</span>
          <Hearts
            key={ratePrompt.id}
            value={rateOf(ratePrompt.id)}
            toggle={false}
            onPick={(v) => {
              const id = ratePrompt.id;
              rate(id, v);
              // 그사이 다른 일정을 체크해 하트 줄이 바뀌었으면 그 줄은 닫지 않는다
              setTimeout(() => setRatePrompt((cur) => (cur?.id === id ? null : cur)), 600);
            }}
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
          // 주간 아이템에는 장소·메모가 없다. 초대 메일에 실으려면 같은 달
          // 이벤트 목록에서 원본을 찾아 넘긴다 (없으면 제목·시간만 나간다).
          fullEvent={
            events.find(
              (e) => toEventKey(e.id) === toEventKey(detailEvent.id),
            ) ?? null
          }
          isCompleted={completed.has(normalizeEventKey(detailEvent.id))}
          canToggleComplete={!!viewerIsOwner}
          onToggleComplete={async () => {
            const wasDone = completed.has(normalizeEventKey(detailEvent.id));
            const ok = await handleToggleComplete(detailEvent.id);
            // iOS: 완료하면 '후속으로 할 일이 있나요?'(이 기기에서 끌 수 있음) — 저장 실패면 묻지 않는다
            if (ok && !wasDone && viewerIsOwner && askFollowUp()) setAfterDone({ id: detailEvent.id, title: detailEvent.title });
          }}
          rating={rateOf(detailEvent.id)}
          onRate={(v) => setRatingLocal(detailEvent.id, v)}
          followUpRefresh={followUpRefresh}
          onNewFollowUpEvent={
            viewerIsOwner
              ? () => {
                  setFollowUpSource(detailEvent.id);
                  setDetailEvent(null);
                  openCreateForm();
                }
              : undefined
          }
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
            refreshWeek();
          }}
          onClose={() => setDetailEvent(null)}
        />
      )}

      {viewMode === "year" && (
        <YearView
          weekStart={weekStart}
          year={year}
          events={events}
          eventsForDay={eventsForDay}
          today={today}
          onMonthClick={(m) => {
            setMonth(m);
            setViewMode("month");
            setSelectedDay(phoneDefaultDay(year, m));
            fetchEvents(year, m);
          }}
        />
      )}

      {viewMode === "quarter" && (
        <QuarterView
          weekStart={weekStart}
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
                  autoFocus
                />
              </div>

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
                      onChange={(e) =>
                        setForm((f) => {
                          // 시작을 옮기면 길이를 유지한 채 끝도 함께 옮긴다.
                          const toMin = (t: string) => {
                            const [h, m] = t.split(":").map(Number);
                            return h * 60 + m;
                          };
                          const dur = Math.max(15, toMin(f.endTime) - toMin(f.startTime));
                          const next = e.target.value;
                          if (!next) return { ...f, startTime: next };
                          const end = Math.min(toMin(next) + dur, 23 * 60 + 59);
                          return {
                            ...f,
                            startTime: next,
                            endTime: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
                          };
                        })
                      }
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

              {/* 길이 칩 — 시작 시각에서 바로 끝 시각을 정한다 */}
              {!form.allDay && (
                <div className="flex flex-wrap gap-1.5">
                  {[30, 60, 90, 120].map((min) => {
                    const [h, m] = form.startTime.split(":").map(Number);
                    const total = h * 60 + m + min;
                    const end = `${String(Math.min(23, Math.floor(total / 60))).padStart(2, "0")}:${String(total >= 24 * 60 ? 59 : total % 60).padStart(2, "0")}`;
                    const active = form.endTime === end;
                    return (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, endTime: end }))}
                        className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                          active
                            ? "bg-navy-500 text-white"
                            : "border border-charcoal-700 text-charcoal-300 hover:border-charcoal-500"
                        }`}
                      >
                        {min < 60 ? `${min}분` : min % 60 === 0 ? `${min / 60}시간` : `${Math.floor(min / 60)}시간 ${min % 60}분`}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-charcoal-800/70 px-3 py-2 text-xs font-medium text-charcoal-400 hover:border-charcoal-600"
              >
                <span>메모 · 위치 · 참석자{myCalendars.length > 1 ? " · 캘린더" : ""}</span>
                <span>{moreOpen ? "접기" : "더 보기"}</span>
              </button>

              {moreOpen && (
                <div className="space-y-4">
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
              {myCalendars.length > 1 && (
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

              {/* 참석자 — 저장된 일정은 바로 붙고, 새 일정은 담아 뒀다가 저장 직후 초대한다. */}
              {editingEvent ? (
                <EventParticipantsPanel
                  eventId={editingEvent.id}
                  title={editingEvent.title}
                  startAt={editingEvent.start_at}
                  endAt={editingEvent.end_at}
                  allDay={editingEvent.all_day}
                  location={editingEvent.location ?? null}
                  description={editingEvent.description}
                />
              ) : (
                <PendingParticipantsPanel
                  pending={pendingParticipants}
                  onChange={setPendingParticipants}
                />
              )}

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
            refreshWeek();
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
            refreshWeek();
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
        className="fixed z-50 w-[280px] rounded-xl border border-charcoal-800/70 bg-[rgb(var(--bg-base))] p-4 shadow-2xl max-md:rounded-2xl"
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
  onOpen,
  onEdit,
  onDelete,
  completed,
  ratings,
  onToggleComplete,
}: {
  events: Event[];
  ratings?: Record<string, number>;
  /** 제목·시간을 누르면 상세(휴대폰은 아래 시트) — 없으면 누를 수 없다 */
  onOpen?: (event: Event) => void;
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
              className="group/chk mt-0.5 flex shrink-0 items-center justify-center max-md:-m-3.5 max-md:h-11 max-md:w-11"
            >
              {/* 모바일은 44px 버튼 안에 16px 상자(감사 7) */}
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                  isDone
                    ? "border-navy-400 bg-navy-500 text-white"
                    : "border-charcoal-600 group-hover/chk:border-charcoal-400"
                }`}
              >
                {isDone && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </span>
            </button>
            <div
              className={`min-w-0 flex-1 ${onOpen ? "cursor-pointer" : ""}`}
              role={onOpen ? "button" : undefined}
              tabIndex={onOpen ? 0 : undefined}
              aria-label={onOpen ? `${ev.title} 상세 보기` : undefined}
              onClick={onOpen ? () => onOpen(ev) : undefined}
              onKeyDown={
                onOpen
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(ev);
                      }
                    }
                  : undefined
              }
            >
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
                {ratings?.[toEventKey(ev.id)] != null && (
                  <span className="shrink-0 text-xs text-pink-500" aria-label={`만족도 ${ratings[toEventKey(ev.id)]}`}>
                    ♥ {ratings[toEventKey(ev.id)]}
                  </span>
                )}
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
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-md:-my-2.5 max-md:opacity-100">
                <button
                  onClick={() => onEdit(ev)}
                  className="flex items-center justify-center rounded p-1 text-charcoal-500 hover:bg-charcoal-700/50 hover:text-charcoal-300 max-md:h-11 max-md:w-11"
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
                  className="flex items-center justify-center rounded p-1 text-charcoal-500 hover:bg-red-900/30 hover:text-red-400 max-md:h-11 max-md:w-11"
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
  weekStart = "mon",
}: {
  weekStart?: WeekStart;
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
        const miniDays = getCalendarDays(year, monthIdx, weekStart);
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
              {weekdayLabels(weekStart).map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-3xs font-medium ${
                    i === saturdayIndex(weekStart) ? "text-blue-600 dark:text-blue-400" : i === sundayIndex(weekStart) ? "text-red-600 dark:text-red-400" : "text-charcoal-600"
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
  weekStart = "mon",
}: {
  weekStart?: WeekStart;
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
        const miniDays = getCalendarDays(year, monthIdx, weekStart);
        const isCurrentMonth = year === today.getFullYear() && monthIdx === today.getMonth();

        return (
          <div
            key={monthIdx}
            className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-4 max-md:rounded-2xl"
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
              {weekdayLabels(weekStart).map((d, i) => (
                <div
                  key={d}
                  className={`py-1 text-center text-2xs font-medium ${
                    i === saturdayIndex(weekStart) ? "text-blue-600 dark:text-blue-400" : i === sundayIndex(weekStart) ? "text-red-600 dark:text-red-400" : "text-charcoal-600"
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
                const isSat = colIdx === saturdayIndex(weekStart);
                const isSun = colIdx === sundayIndex(weekStart);

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
                                ? "text-red-600 dark:text-red-400"
                                : isSat
                                  ? "text-blue-600 dark:text-blue-400"
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
  fullEvent,
  invite,
  onRespond,
  isCompleted,
  canToggleComplete,
  onToggleComplete,
  onEdit,
  onDelete,
  onClose,
  rating = null,
  onRate,
  onNewFollowUpEvent,
  followUpRefresh = 0,
}: {
  rating?: number | null;
  onRate?: (v: number | null) => void;
  onNewFollowUpEvent?: () => void;
  followUpRefresh?: number;
  item: WeekItem;
  /** 같은 일정의 원본 — 장소·메모처럼 주간 아이템에 없는 값을 얻는 데 쓴다. */
  fullEvent?: Event | null;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm max-md:items-end max-md:p-0"
      onClick={onClose}
    >
      {/* 휴대폰: 아래에서 올라오는 시트(iOS 일정 상세와 같은 자리) · 데스크톱: 가운데 창 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${item.title} 상세`}
        data-testid="eventDetail"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5 shadow-2xl max-md:max-h-[88dvh] max-md:max-w-none max-md:rounded-b-none max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0 max-md:pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-charcoal-700 md:hidden" aria-hidden />
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
              <>
                {invite?.location && (
                  <p className="mt-1 text-xs text-charcoal-400">
                    📍 {invite.location}
                  </p>
                )}
                <p className="mt-2 text-2xs text-purple-300">
                  {invite?.inviterName ?? "누군가"}님이 초대한 일정이에요.
                  {invite?.status === "accepted" ? " 수락함." : ""}
                </p>
              </>
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

        {!isInvite && (fullEvent?.location || fullEvent?.description) && (
          <div className="mt-4 space-y-2">
            {fullEvent?.location && (
              <p className="text-sm text-charcoal-300">📍 {fullEvent.location}</p>
            )}
            {fullEvent?.description && (
              <div>
                <p className="mb-1 text-xs font-medium text-charcoal-500">메모</p>
                <p className="whitespace-pre-wrap rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-3 text-sm text-charcoal-300">
                  {fullEvent.description}
                </p>
              </div>
            )}
          </div>
        )}

        {isInvite && invite?.description && (
          <p className="mt-4 whitespace-pre-wrap rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-3 text-xs text-charcoal-300">
            {invite.description}
          </p>
        )}

        {canToggleComplete && !isInvite && isCompleted && onRate && (
          <RatingRow eventId={item.id} value={rating} onChange={onRate} />
        )}

        {canToggleComplete && !isInvite && (
          <FollowUpSection
            eventId={item.id}
            description={fullEvent?.description ?? null}
            onNewFollowUpEvent={onNewFollowUpEvent}
            refreshKey={followUpRefresh}
          />
        )}

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
              location={fullEvent?.location ?? null}
              description={fullEvent?.description ?? null}
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
                className={`rounded-lg max-md:min-h-11 px-3 py-2 text-sm font-medium ${
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
                className="rounded-lg max-md:min-h-11 border border-charcoal-700 px-3 py-2 text-sm text-charcoal-200 hover:border-charcoal-600 hover:bg-charcoal-800/60"
              >
                수정
              </button>
            )}
            {!isInvite && canToggleComplete && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg max-md:min-h-11 border border-red-500/40 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                삭제
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg max-md:min-h-11 px-3 py-2 text-sm text-charcoal-300 hover:bg-charcoal-800/60"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

