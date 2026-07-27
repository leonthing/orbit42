import { apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import {
  listEventsForUser,
  createEventForUser,
  type CalendarEvent,
} from "@/lib/calendar-events";

export const dynamic = "force-dynamic";

function toApiEvent(e: CalendarEvent) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startAt: e.start_at,
    endAt: e.end_at,
    allDay: e.all_day,
    calendarId: e.calendar_id,
    source: e.source,
    tentative: e.tentative,
  };
}

async function listApiCalendars(userId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("calendars")
    .select("id, name, color, purpose, source, is_default")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.name as string,
    color: (c.color as string | null) ?? "#6366f1",
    purpose: (c.purpose as string | null) ?? "personal",
    source: c.source as string,
    isDefault: Boolean(c.is_default),
  }));
}

// GET ?year=2026&month=7  (month: 1-12)
export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return Response.json(
      { error: "year(2000~2100)와 month(1~12)를 지정해주세요." },
      { status: 400 },
    );
  }

  const { listEventBucketOverrides, listEventEarnings, getIncomeSettings } =
    await import("@/lib/time-asset");
  const { getCompletedKeys } = await import("@/lib/event-completions");
  const { normalizeEventKey } = await import("@/lib/event-key");
  const db = getAdminClient();
  const [events, calendars, overrides, earnings, income, calRatesRes] =
    await Promise.all([
      listEventsForUser(userId, year, month - 1),
      listApiCalendars(userId),
      listEventBucketOverrides(userId),
      listEventEarnings(userId),
      getIncomeSettings(userId),
      db
        .from("calendars")
        .select("id, hourly_rate_krw")
        .eq("user_id", userId)
        .not("hourly_rate_krw", "is", null),
    ]);
  // 완료 체크(투두) — 웹과 같은 event_completions 를 공유한다.
  const completedSet = new Set(
    await getCompletedKeys(events.map((e) => normalizeEventKey(e.id))),
  );

  // "모든 일정 = 시간 = 금액" — 수동 기록이 없어도 캘린더 단가 → 기준 시급으로
  // 환산한 시간 가치를 함께 내려준다 (종일 일정 제외).
  const rateByCalendar = new Map<string, number>();
  for (const c of calRatesRes.data ?? []) {
    if (c.hourly_rate_krw != null && Number(c.hourly_rate_krw) > 0) {
      rateByCalendar.set(c.id as string, Number(c.hourly_rate_krw));
    }
  }
  const autoValueOf = (e: CalendarEvent): number | null => {
    if (e.all_day) return null;
    const rate =
      (e.calendar_id ? rateByCalendar.get(e.calendar_id) : undefined) ??
      income.hourlyValueKrw;
    if (rate == null) return null;
    const hours = (Date.parse(e.end_at) - Date.parse(e.start_at)) / 3_600_000;
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return Math.round(hours * rate);
  };

  return Response.json({
    events: events.map((e) => ({
      ...toApiEvent(e),
      bucketOverride: overrides.get(e.id) ?? null,
      earningKrw: earnings.get(e.id) ?? null,
      autoValueKrw: autoValueOf(e),
      completed: completedSet.has(normalizeEventKey(e.id)),
    })),
    calendars,
  });
}

// POST { title, description?, startAt, endAt, allDay, calendarId? }
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: {
    title?: string;
    description?: string | null;
    startAt?: string;
    endAt?: string;
    allDay?: boolean;
    calendarId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return Response.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }
  if (title.length > 200) {
    return Response.json({ error: "제목이 너무 길어요." }, { status: 400 });
  }
  const startAt = Date.parse(body.startAt ?? "");
  const endAt = Date.parse(body.endAt ?? "");
  if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
    return Response.json(
      { error: "시작/종료 시각이 올바르지 않아요." },
      { status: 400 },
    );
  }
  if (endAt < startAt) {
    return Response.json(
      { error: "종료가 시작보다 빠를 수 없어요." },
      { status: 400 },
    );
  }

  try {
    const event = await createEventForUser(userId, {
      title,
      description: body.description?.slice(0, 2000) ?? null,
      start_at: body.startAt as string,
      end_at: body.endAt as string,
      all_day: Boolean(body.allDay),
      calendar_id: body.calendarId ?? null,
    });
    return Response.json({ event: toApiEvent(event) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "일정 생성에 실패했어요.";
    return Response.json({ error: message }, { status: 400 });
  }
}
