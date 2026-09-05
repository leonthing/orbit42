/**
 * Calendar event listing/creation, keyed by an explicit userId.
 *
 * Extracted from app/[username]/calendar/actions.ts so both the web server
 * actions (cookie session) and the mobile /api/v1 routes (bearer token) share
 * one implementation. Callers are responsible for resolving a trusted userId.
 */

import { getAdminClient } from "@/lib/supabase";
import {
  getAuthenticatedCalendar,
  listExtraGoogleAccounts,
  getCalendarForExtraAccount,
} from "@/lib/google";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  business_id: string | null;
  calendar_id: string | null;
  source: "local" | "google";
  tentative: boolean;
  created_at: string;
  updated_at: string;
  /** 위치 — 자유 텍스트. 주소 검색으로 고르면 좌표도 함께 저장된다. */
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  /** 시작 전 이동시간(분) — 예약 가능 시간 계산에서 그만큼 앞을 막는다. */
  travel_min?: number | null;
  /** 공유 캘린더에서 남이 만든 일정일 때의 작성자 */
  authorUsername?: string | null;
  authorName?: string | null;
};

export type CalendarEventInput = {
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  business_id?: string | null;
  calendar_id?: string | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  travel_min?: number | null;
};

/**
 * Local + Google events for one month, merged and sorted.
 * @param month 0-based (JS Date convention), matching the existing web action.
 * @param calendarIds Optional list of `calendars.id` (native UUIDs, unified).
 *   When provided, filters BOTH local events (by calendar_id) AND Google
 *   events (by resolving each native calendar's `google_calendar_id`).
 */
function parseCoord(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function listEventsForUser(
  userId: string,
  year: number,
  month: number,
  calendarIds?: string[],
): Promise<CalendarEvent[]> {
  const db = getAdminClient();

  const startOfMonth = new Date(year, month, 1).toISOString();
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();

  // Resolve the user's calendars so we can translate the filter.
  const { sharedCalendarsFor: sharedFor } = await import("@/lib/calendar-members");
  const myShared = await sharedFor(userId);
  const { data: allCalsData } = await db
    .from("calendars")
    .select("id, source, google_calendar_id")
    .or(
      myShared.size > 0
        ? `user_id.eq.${userId},id.in.(${Array.from(myShared.keys()).join(",")})`
        : `user_id.eq.${userId}`,
    );
  const allCals = (allCalsData ?? []) as Array<{
    id: string;
    source: "native" | "google";
    google_calendar_id: string | null;
  }>;

  const hasExplicitFilter = Array.isArray(calendarIds);
  const filterSet = new Set(calendarIds ?? []);
  const selectedCals = hasExplicitFilter
    ? allCals.filter((c) => filterSet.has(c.id))
    : allCals;
  const googleCalIdsToFetch = selectedCals
    .filter((c) => c.source === "google" && c.google_calendar_id)
    .map((c) => c.google_calendar_id as string);

  // 공유받은 캘린더 id — 그 캘린더의 일정은 누가 만들었든 함께 본다.
  const { sharedCalendarsFor } = await import("@/lib/calendar-members");
  const sharedMap = await sharedCalendarsFor(userId);
  const sharedIds = Array.from(sharedMap.keys());

  // Local events (optionally filtered by calendar_id).
  let localQuery = db
    .from("events")
    .select("*")
    .gte("start_at", startOfMonth)
    .lte("start_at", endOfMonth)
    .order("start_at", { ascending: true });
  localQuery =
    sharedIds.length > 0
      ? localQuery.or(`user_id.eq.${userId},calendar_id.in.(${sharedIds.join(",")})`)
      : localQuery.eq("user_id", userId);
  if (hasExplicitFilter) {
    const nativeIds = selectedCals
      .filter((c) => c.source === "native")
      .map((c) => c.id);
    if (nativeIds.length === 0) {
      localQuery = localQuery.eq("id", "__none__"); // force empty
    } else {
      localQuery = localQuery.in("calendar_id", nativeIds);
    }
  }
  const { data: localData } = await localQuery;
  const localEvents: CalendarEvent[] = (localData ?? []).map(
    (e: Record<string, unknown>) => ({
      ...e,
      source: "local" as const,
    }),
  ) as CalendarEvent[];

  // 공유 캘린더에서 남이 만든 일정은 작성자를 표시한다.
  const otherAuthorIds = Array.from(
    new Set(
      localEvents
        .map((e) => (e as unknown as { user_id?: string }).user_id)
        .filter((id): id is string => !!id && id !== userId),
    ),
  );
  if (otherAuthorIds.length > 0) {
    const { data: authors } = await db
      .from("users")
      .select("id, username, display_name")
      .in("id", otherAuthorIds);
    const byId = new Map(
      (authors ?? []).map((a) => [
        a.id as string,
        {
          username: a.username as string,
          name: (a.display_name as string | null) ?? (a.username as string),
        },
      ]),
    );
    for (const e of localEvents) {
      const authorId = (e as unknown as { user_id?: string }).user_id;
      if (authorId && authorId !== userId) {
        const author = byId.get(authorId);
        e.authorUsername = author?.username ?? null;
        e.authorName = author?.name ?? null;
      }
    }
  }

  // Google Calendar events — only for the selected google-backed calendars.
  let googleEvents: CalendarEvent[] = [];
  try {
    const calendar = await getAuthenticatedCalendar(userId);
    if (calendar) {
      const ids = hasExplicitFilter
        ? googleCalIdsToFetch
        : googleCalIdsToFetch.length > 0
          ? googleCalIdsToFetch
          : ["primary"];

      // Map google_calendar_id → native calendars.id for color/lookup.
      const gcalToNative = new Map<string, string>();
      for (const c of allCals) {
        if (c.source === "google" && c.google_calendar_id) {
          gcalToNative.set(c.google_calendar_id, c.id);
        }
      }

      const allItems = await Promise.all(
        ids.map(async (calId) => {
          try {
            const res = await calendar.events.list({
              calendarId: calId,
              timeMin: startOfMonth,
              timeMax: endOfMonth,
              singleEvents: true,
              orderBy: "startTime",
              maxResults: 200,
            });
            return (res.data.items || []).map((item) => ({ item, calId }));
          } catch {
            return [];
          }
        }),
      );

      googleEvents = allItems.flat().map(({ item, calId }) => ({
        id: `gcal_${item.id}`,
        title: item.summary || "(제목 없음)",
        description: item.description || null,
        start_at: item.start?.dateTime || item.start?.date || "",
        end_at: item.end?.dateTime || item.end?.date || "",
        all_day: !!item.start?.date,
        calendar_id: gcalToNative.get(calId) ?? null,
        business_id: null,
        location: item.location || null,
        location_lat: parseCoord(item.extendedProperties?.private?.orbit42Lat),
        location_lng: parseCoord(item.extendedProperties?.private?.orbit42Lng),
        travel_min: parseCoord(item.extendedProperties?.private?.orbit42TravelMin),
        source: "google" as const,
        tentative: item.status === "tentative",
        created_at: item.created || "",
        updated_at: item.updated || "",
      }));
    }
  } catch (err) {
    console.error("Google Calendar fetch error:", err);
  }

  // Merge and sort, deduplicate by id
  const seen = new Set<string>();
  return [...localEvents, ...googleEvents]
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
}

export async function createEventForUser(
  userId: string,
  input: CalendarEventInput,
): Promise<CalendarEvent> {
  const db = getAdminClient();

  // Resolve target calendar: explicit → default → null
  let calendarId = input.calendar_id ?? null;
  let targetCal: {
    source: "native" | "google";
    google_calendar_id: string | null;
  } | null = null;
  if (calendarId) {
    const { data: cal } = await db
      .from("calendars")
      .select("id, user_id, source, google_calendar_id")
      .eq("id", calendarId)
      .single();
    if (!cal) throw new Error("선택한 캘린더에 권한이 없어요.");
    if (cal.user_id !== userId) {
      // 공유받은 캘린더면 editor 권한이 있어야 쓸 수 있다.
      const { canEditCalendar } = await import("@/lib/calendar-members");
      if (!(await canEditCalendar(userId, calendarId))) {
        throw new Error("선택한 캘린더에 권한이 없어요.");
      }
    }
    targetCal = { source: cal.source, google_calendar_id: cal.google_calendar_id };
  } else {
    const { data: def } = await db
      .from("calendars")
      .select("id, source, google_calendar_id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    if (def) {
      calendarId = def.id;
      targetCal = { source: def.source, google_calendar_id: def.google_calendar_id };
    }
  }

  // 구글 연동 캘린더가 대상이면 구글에만 저장한다. 로컬 events 에도 넣으면
  // 조회(로컬+구글 병합) 시 같은 일정이 두 번 보인다 — 구글 이벤트는 DB에
  // 미러링하지 않는 것이 원칙 (updateGoogleEvent 와 동일).
  if (targetCal?.source === "google" && targetCal.google_calendar_id) {
    const calendar = await getAuthenticatedCalendar(userId);
    if (!calendar) {
      throw new Error("Google 캘린더 연결이 필요해요. 프로필 > Google 캘린더에서 다시 연결해주세요.");
    }
    const event: Record<string, unknown> = {
      summary: input.title,
      description: input.description || undefined,
      location: input.location || undefined,
    };
    // 구글 이벤트에는 좌표·이동시간 컬럼이 없어 extendedProperties 에 심어 왕복한다.
    const privateProps: Record<string, string> = {};
    if (input.location_lat != null && input.location_lng != null) {
      privateProps.orbit42Lat = String(input.location_lat);
      privateProps.orbit42Lng = String(input.location_lng);
    }
    if (input.travel_min != null && input.travel_min > 0) {
      privateProps.orbit42TravelMin = String(input.travel_min);
    }
    if (Object.keys(privateProps).length > 0) {
      event.extendedProperties = { private: privateProps };
    }
    if (input.all_day) {
      event.start = { date: input.start_at.split("T")[0] };
      event.end = { date: input.end_at.split("T")[0] };
    } else {
      event.start = { dateTime: input.start_at, timeZone: "Asia/Seoul" };
      event.end = { dateTime: input.end_at, timeZone: "Asia/Seoul" };
    }
    const res = await calendar.events.insert({
      calendarId: targetCal.google_calendar_id,
      requestBody: event,
    });
    const now = new Date().toISOString();
    return {
      id: `gcal_${res.data.id}`,
      title: input.title,
      description: input.description ?? null,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day,
      business_id: null,
      calendar_id: calendarId,
      location: input.location ?? null,
      location_lat: input.location_lat ?? null,
      location_lng: input.location_lng ?? null,
      travel_min: input.travel_min ?? null,
      source: "google",
      tentative: false,
      created_at: now,
      updated_at: now,
    };
  }

  const { data, error } = await db
    .from("events")
    .insert({
      user_id: userId,
      calendar_id: calendarId,
      title: input.title,
      description: input.description ?? null,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day,
      business_id: input.business_id ?? null,
      location: input.location ?? null,
      location_lat: input.location_lat ?? null,
      location_lng: input.location_lng ?? null,
      travel_min: input.travel_min ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return { ...data, source: "local" } as CalendarEvent;
}

// ── 캘린더 이동 ────────────────────────────────────────────────

type CalendarRow = {
  id: string;
  source: "native" | "google";
  google_calendar_id: string | null;
  google_account_id: string | null;
};

/** 캘린더가 속한 Google 계정의 API 클라이언트 (기본 계정 또는 추가 계정). */
async function clientForCalendar(userId: string, cal: CalendarRow) {
  if (!cal.google_account_id) return getAuthenticatedCalendar(userId);
  const extras = await listExtraGoogleAccounts(userId);
  const account = extras.find((a) => a.id === cal.google_account_id);
  if (!account) return null;
  return getCalendarForExtraAccount(account);
}

/** 이동으로 이벤트 id 가 바뀔 때 자산 분류·수익 기록·완료 체크 키를 새 id 로 이관.
 * 분류·수익은 클라이언트 원형 id(uuid/gcal_*)로, 완료 체크는 정규화 키
 * (local:/google:)로 저장돼 있어 각각 형식에 맞춰 옮긴다. */
async function migrateEventKeys(userId: string, oldId: string, newId: string) {
  const db = getAdminClient();
  await db
    .from("event_bucket_overrides")
    .update({ event_key: newId })
    .eq("user_id", userId)
    .eq("event_key", oldId);
  await db
    .from("event_earnings")
    .update({ event_key: newId })
    .eq("user_id", userId)
    .eq("event_key", oldId);
  await db
    .from("event_posts")
    .update({ event_key: newId })
    .eq("user_id", userId)
    .eq("event_key", oldId);
  const { normalizeEventKey } = await import("@/lib/event-key");
  await db
    .from("event_completions")
    .update({ event_key: normalizeEventKey(newId) })
    .eq("user_id", userId)
    .eq("event_key", normalizeEventKey(oldId));
  const { rekeyParticipants } = await import("@/lib/event-participants");
  await rekeyParticipants(userId, oldId, newId);
}

function googleEventBody(input: {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  travel_min?: number | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description || undefined,
    location: input.location || undefined,
  };
  const privateProps: Record<string, string> = {};
  if (input.location_lat != null && input.location_lng != null) {
    privateProps.orbit42Lat = String(input.location_lat);
    privateProps.orbit42Lng = String(input.location_lng);
  }
  if (input.travel_min != null && input.travel_min > 0) {
    privateProps.orbit42TravelMin = String(input.travel_min);
  }
  if (Object.keys(privateProps).length > 0) {
    body.extendedProperties = { private: privateProps };
  }
  if (input.all_day) {
    body.start = { date: input.start_at.split("T")[0] };
    body.end = { date: input.end_at.split("T")[0] };
  } else {
    body.start = { dateTime: input.start_at, timeZone: "Asia/Seoul" };
    body.end = { dateTime: input.end_at, timeZone: "Asia/Seoul" };
  }
  return body;
}

/**
 * 이벤트를 다른 캘린더로 이동한다 (수정 patch 를 함께 적용).
 * - 로컬 → 로컬: calendar_id 재배정
 * - 로컬 → 구글: 구글에 생성 후 로컬 삭제
 * - 구글 → 로컬: 구글에서 읽어 로컬 생성 후 구글 삭제 (삭제 실패 시 롤백)
 * - 구글 → 구글: 같은 계정이면 events.move, 다른 계정은 미지원
 * id 가 바뀌면 자산 분류·완료 체크 키도 따라간다.
 */
export async function moveEventToCalendar(
  userId: string,
  eventId: string,
  targetCalendarId: string,
  sourceCalendarId: string | null,
  patch: Partial<CalendarEventInput>,
): Promise<{ ok: true; newId: string } | { error: string }> {
  const db = getAdminClient();
  const { data: target } = await db
    .from("calendars")
    .select("id, source, google_calendar_id, google_account_id")
    .eq("id", targetCalendarId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return { error: "옮길 캘린더를 찾을 수 없어요." };

  const isGoogleEvent = eventId.startsWith("gcal_");

  // ── 로컬 이벤트 ──
  if (!isGoogleEvent) {
    const { data: row } = await db
      .from("events")
      .select("id, title, description, start_at, end_at, all_day, location, location_lat, location_lng, travel_min")
      .eq("id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return { error: "일정을 찾을 수 없어요." };

    if (target.source === "native") {
      const { error } = await db
        .from("events")
        .update({
          ...patch,
          calendar_id: target.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId)
        .eq("user_id", userId);
      if (error) return { error: "일정을 옮기지 못했어요." };
      return { ok: true, newId: eventId };
    }

    // 로컬 → 구글
    if (!target.google_calendar_id) {
      return { error: "Google 캘린더 정보를 찾을 수 없어요." };
    }
    const client = await clientForCalendar(userId, target as CalendarRow);
    if (!client) return { error: "Google 캘린더 연결이 필요해요." };
    const merged = {
      title: patch.title ?? (row.title as string),
      description:
        patch.description !== undefined
          ? patch.description
          : ((row.description as string | null) ?? null),
      start_at: patch.start_at ?? (row.start_at as string),
      end_at: patch.end_at ?? ((row.end_at as string | null) || (row.start_at as string)),
      all_day: patch.all_day ?? Boolean(row.all_day),
      location: (row.location as string | null) ?? null,
      location_lat: (row.location_lat as number | null) ?? null,
      location_lng: (row.location_lng as number | null) ?? null,
      travel_min: (row.travel_min as number | null) ?? null,
    };
    let createdId: string | null | undefined;
    try {
      const res = await client.events.insert({
        calendarId: target.google_calendar_id,
        requestBody: googleEventBody(merged),
      });
      createdId = res.data.id;
    } catch (err) {
      console.error("moveEvent local→google insert", err);
      return { error: "Google에 일정을 만들지 못했어요." };
    }
    if (!createdId) return { error: "Google에 일정을 만들지 못했어요." };
    await db.from("events").delete().eq("id", eventId).eq("user_id", userId);
    const newId = `gcal_${createdId}`;
    await migrateEventKeys(userId, eventId, newId);
    return { ok: true, newId };
  }

  // ── 구글 이벤트 ──
  if (!sourceCalendarId) return { error: "현재 캘린더 정보가 필요해요." };
  const { data: source } = await db
    .from("calendars")
    .select("id, source, google_calendar_id, google_account_id")
    .eq("id", sourceCalendarId)
    .eq("user_id", userId)
    .eq("source", "google")
    .maybeSingle();
  if (!source?.google_calendar_id) {
    return { error: "현재 Google 캘린더를 찾을 수 없어요." };
  }
  const srcClient = await clientForCalendar(userId, source as CalendarRow);
  if (!srcClient) return { error: "Google 캘린더 연결이 필요해요." };
  const googleId = eventId.slice("gcal_".length);

  if (target.source === "google") {
    if (!target.google_calendar_id) {
      return { error: "Google 캘린더 정보를 찾을 수 없어요." };
    }
    if (target.google_account_id !== source.google_account_id) {
      return { error: "다른 Google 계정의 캘린더로는 옮길 수 없어요." };
    }
    try {
      await srcClient.events.move({
        calendarId: source.google_calendar_id,
        eventId: googleId,
        destination: target.google_calendar_id,
      });
    } catch (err) {
      console.error("moveEvent google→google", err);
      return { error: "Google 캘린더 간 이동에 실패했어요." };
    }
    if (Object.keys(patch).length > 0) {
      // 바뀐 필드만 부분 patch (updateGoogleEvent 와 같은 매핑).
      const patchBody: Record<string, unknown> = {};
      if (patch.title !== undefined) patchBody.summary = patch.title;
      if (patch.description !== undefined) {
        patchBody.description = patch.description ?? "";
      }
      if (patch.start_at !== undefined && patch.end_at !== undefined) {
        if (patch.all_day) {
          patchBody.start = { date: patch.start_at.split("T")[0] };
          patchBody.end = { date: patch.end_at.split("T")[0] };
        } else {
          patchBody.start = { dateTime: patch.start_at, timeZone: "Asia/Seoul" };
          patchBody.end = { dateTime: patch.end_at, timeZone: "Asia/Seoul" };
        }
      }
      try {
        await srcClient.events.patch({
          calendarId: target.google_calendar_id,
          eventId: googleId,
          requestBody: patchBody,
        });
      } catch {
        return { error: "캘린더는 옮겼지만 내용 수정에 실패했어요. 다시 시도해 주세요." };
      }
    }
    return { ok: true, newId: eventId };
  }

  // 구글 → 로컬
  let g: { summary?: string | null; description?: string | null; start?: { date?: string | null; dateTime?: string | null }; end?: { date?: string | null; dateTime?: string | null } };
  try {
    const res = await srcClient.events.get({
      calendarId: source.google_calendar_id,
      eventId: googleId,
    });
    g = res.data;
  } catch (err) {
    console.error("moveEvent google→local get", err);
    return { error: "Google 일정을 읽지 못했어요." };
  }
  const allDay = !!g.start?.date;
  const startIso = g.start?.dateTime || g.start?.date;
  const endIso = g.end?.dateTime || g.end?.date || startIso;
  if (!startIso) return { error: "일정 시간 정보를 읽지 못했어요." };

  const merged = {
    title: patch.title ?? (g.summary || "(제목 없음)"),
    description:
      patch.description !== undefined ? patch.description : (g.description ?? null),
    start_at: patch.start_at ?? startIso,
    end_at: patch.end_at ?? (endIso as string),
    all_day: patch.all_day ?? allDay,
    location: ((g as { location?: string | null }).location ?? null) as string | null,
    location_lat: parseCoord(
      (g as { extendedProperties?: { private?: Record<string, string> } })
        .extendedProperties?.private?.orbit42Lat,
    ),
    location_lng: parseCoord(
      (g as { extendedProperties?: { private?: Record<string, string> } })
        .extendedProperties?.private?.orbit42Lng,
    ),
    travel_min: parseCoord(
      (g as { extendedProperties?: { private?: Record<string, string> } })
        .extendedProperties?.private?.orbit42TravelMin,
    ),
  };
  const { data: inserted, error: insErr } = await db
    .from("events")
    .insert({
      user_id: userId,
      calendar_id: target.id,
      title: merged.title,
      description: merged.description,
      start_at: merged.start_at,
      end_at: merged.end_at,
      all_day: merged.all_day,
      location: merged.location,
      location_lat: merged.location_lat,
      location_lng: merged.location_lng,
      travel_min: merged.travel_min,
    })
    .select("id")
    .single();
  if (insErr || !inserted) return { error: "일정을 옮기지 못했어요." };
  try {
    await srcClient.events.delete({
      calendarId: source.google_calendar_id,
      eventId: googleId,
    });
  } catch (err) {
    // 구글 원본 삭제 실패 → 로컬 사본 제거해 중복을 막고 이동 취소.
    console.error("moveEvent google→local delete", err);
    await db.from("events").delete().eq("id", inserted.id);
    return { error: "Google 일정을 삭제하지 못해 이동을 취소했어요." };
  }
  await migrateEventKeys(userId, eventId, inserted.id as string);
  return { ok: true, newId: inserted.id as string };
}
