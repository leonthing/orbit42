import { apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import {
  listEventsForUser,
  createEventForUser,
  attendeeUsersByEmail,
  toApiAttendees,
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
    location: e.location ?? null,
    locationLat: e.location_lat ?? null,
    locationLng: e.location_lng ?? null,
    travelMin: e.travel_min ?? null,
    // 구글 일정에서 내가 주최자인지 — 아니면 앱이 참석자 추가를 숨긴다
    isOrganizer: e.source === "google" ? e.organizer_self === true : undefined,
    // 남이 주최해도 '참석자 수정 허용'이면 앱이 수정·끌어 옮기기를 연다
    guestsCanModify: e.source === "google" ? e.guests_can_modify === true : undefined,
    // 예약에서 생긴 일정 — 앱은 끌어 옮기지 못하게 하고, 상세에서 그 예약으로 보낸다
    isBooking: Boolean(e.booking_id),
    bookingId: e.booking_id ?? null,
    bookingRole: e.booking_role ?? null,
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

/** "2026-10-13" → 그 날 00:00 KST (잘못된 값이면 null) */
function kstDayStart(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 범위 조회 — 걸친 달마다 읽어 합치고, 범위와 겹치는 일정만 남긴다. */
async function listEventsInRange(userId: string, from: Date, to: Date) {
  // 달 경계는 서버 시간대 기준이라 앞뒤 하루씩 넉넉히 잡아 걸친 달을 모두 읽는다.
  const months: Array<[number, number]> = [];
  const cursor = new Date(from.getTime() - 86_400_000);
  cursor.setUTCDate(1);
  const last = new Date(to.getTime() + 86_400_000);
  while (
    cursor.getUTCFullYear() < last.getUTCFullYear() ||
    (cursor.getUTCFullYear() === last.getUTCFullYear() &&
      cursor.getUTCMonth() <= last.getUTCMonth())
  ) {
    months.push([cursor.getUTCFullYear(), cursor.getUTCMonth()]);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const lists = await Promise.all(
    months.map(([y, m]) => listEventsForUser(userId, y, m)),
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      const start = Date.parse(e.start_at);
      const end = Date.parse(e.end_at || e.start_at);
      // 종일 일정의 end 는 다음 날(배타) — 그대로 비교해도 범위 시작과 같으면 빠진다.
      return start < to.getTime() && (Number.isNaN(end) ? start : end) > from.getTime();
    })
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
}

// GET ?year=2026&month=7  (month: 1-12)
// GET ?from=2026-10-13&to=2026-10-19 — KST 날짜 범위(양 끝 포함, 최대 93일)
export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const url = new URL(request.url);
  const rangeFrom = kstDayStart(url.searchParams.get("from"));
  const rangeToDay = kstDayStart(url.searchParams.get("to"));
  const isRange = url.searchParams.has("from") || url.searchParams.has("to");
  if (isRange) {
    if (!rangeFrom || !rangeToDay || rangeToDay < rangeFrom) {
      return Response.json(
        { error: "from/to 는 YYYY-MM-DD 형식이고 from ≤ to 여야 해요." },
        { status: 400 },
      );
    }
    if (rangeToDay.getTime() - rangeFrom.getTime() > 92 * 86_400_000) {
      return Response.json({ error: "범위는 최대 93일이에요." }, { status: 400 });
    }
  }
  const rangeTo = rangeToDay ? new Date(rangeToDay.getTime() + 86_400_000) : null;
  const kstNow = new Date(Date.now() + 9 * 3_600_000);
  const year = isRange ? kstNow.getUTCFullYear() : Number(url.searchParams.get("year"));
  const month = isRange ? kstNow.getUTCMonth() + 1 : Number(url.searchParams.get("month"));
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
  const { getEventStatuses } = await import("@/lib/event-completions");
  const { normalizeEventKey } = await import("@/lib/event-key");
  const db = getAdminClient();
  const [events, calendars, overrides, earnings, income, calRatesRes] =
    await Promise.all([
      isRange && rangeFrom && rangeTo
        ? listEventsInRange(userId, rangeFrom, rangeTo)
        : listEventsForUser(userId, year, month - 1),
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
  // 상태는 완료(done)·보관(archived) — completed 는 옛 앱 호환용으로 done 일 때만 true.
  const statuses = await getEventStatuses(events.map((e) => normalizeEventKey(e.id)));
  // 중요도·별점(1.5.0 A) — 본인 것만. 없는 일정은 보통·별점 없음.
  const { getAnnotations, IMPORTANCE_NAMES } = await import("@/lib/event-annotations");
  const { toEventKey } = await import("@/lib/event-key");
  const annotations = await getAnnotations(userId, events.map((e) => e.id));

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

  const attendeeUsers = await attendeeUsersByEmail(
    events.flatMap((e) => (e.attendees ?? []).map((a) => a.email)),
  );

  // 내가 초대받은 일정 — 읽기 전용 항목으로 병합 (거절한 초대는 제외).
  const { listMyInvites } = await import("@/lib/event-participants");
  const monthStart = isRange && rangeFrom ? rangeFrom : new Date(year, month - 1, 1);
  const monthEnd =
    isRange && rangeTo
      ? new Date(rangeTo.getTime() - 1)
      : new Date(year, month, 0, 23, 59, 59, 999);
  const invites = await listMyInvites(userId, monthStart, monthEnd);

  return Response.json({
    events: [
      ...events.map((e) => ({
        ...toApiEvent(e),
        bucketOverride: overrides.get(e.id) ?? null,
        earningKrw: earnings.get(e.id) ?? null,
        autoValueKrw: autoValueOf(e),
        completed: statuses[normalizeEventKey(e.id)] === "done",
        status: statuses[normalizeEventKey(e.id)] ?? null,
        // 구글 일정의 참석자 (Orbit42 사용자면 username 포함)
        attendees: toApiAttendees(e.attendees, attendeeUsers),
        importance: IMPORTANCE_NAMES[annotations.get(toEventKey(e.id))?.importance ?? 0],
        rating: annotations.get(toEventKey(e.id))?.rating ?? null,
        ratingNote: annotations.get(toEventKey(e.id))?.ratingNote ?? null,
        reminderMinutes: annotations.get(toEventKey(e.id))?.reminderMinutes ?? null,
      })),
      ...invites.map((inv) => ({
        id: `invite_${inv.id}`,
        title: inv.title,
        description: inv.description,
        startAt: inv.start_at,
        endAt: inv.end_at,
        allDay: inv.all_day,
        location: inv.location,
        calendarId: null,
        source: "invite",
        tentative: inv.status === "invited",
        bucketOverride: null,
        earningKrw: null,
        autoValueKrw: null,
        completed: false,
        inviteId: inv.id,
        inviteStatus: inv.status,
        inviterName: inv.inviterName,
        inviterUsername: inv.inviterUsername,
      })),
    ],
    calendars,
  });
}

// POST { title, description?, startAt, endAt, allDay, calendarId?, location?, travelMin? }
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
    location?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;
    travelMin?: number | null;
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
      location: body.location?.trim().slice(0, 300) || null,
      location_lat:
        typeof body.locationLat === "number" && Number.isFinite(body.locationLat)
          ? body.locationLat
          : null,
      location_lng:
        typeof body.locationLng === "number" && Number.isFinite(body.locationLng)
          ? body.locationLng
          : null,
      travel_min:
        typeof body.travelMin === "number" &&
        Number.isFinite(body.travelMin) &&
        body.travelMin > 0
          ? Math.min(Math.round(body.travelMin), 480)
          : null,
    });
    return Response.json({ event: toApiEvent(event) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "일정 생성에 실패했어요.";
    return Response.json({ error: message }, { status: 400 });
  }
}
