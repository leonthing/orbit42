"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import {
  getAuthenticatedCalendar,
  listExtraGoogleAccounts,
  getCalendarForExtraAccount,
} from "@/lib/google";

export type Event = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  business_id: string | null;
  calendar_id: string | null;
  source: "local" | "google";
  created_at: string;
  updated_at: string;
};

export type EventInput = {
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  business_id?: string | null;
  calendar_id?: string | null;
};

export type GoogleCalendarInfo = {
  id: string;
  summary: string;
  backgroundColor: string;
  primary: boolean;
};

export async function getGoogleCalendars(): Promise<GoogleCalendarInfo[]> {
  const userId = await requireUserId();
  const seen = new Set<string>();
  const all: GoogleCalendarInfo[] = [];

  const primary = await getAuthenticatedCalendar(userId);
  if (primary) {
    try {
      const res = await primary.calendarList.list();
      for (const item of res.data.items ?? []) {
        if (!item.id || seen.has(item.id)) continue;
        if (item.accessRole !== "owner") continue;
        seen.add(item.id);
        all.push({
          id: item.id,
          summary: item.summary || "",
          backgroundColor: item.backgroundColor || "#4285f4",
          primary: !!item.primary,
        });
      }
    } catch {
      // ignore
    }
  }

  const extras = await listExtraGoogleAccounts(userId);
  for (const acc of extras) {
    const calendar = await getCalendarForExtraAccount(acc);
    if (!calendar) continue;
    try {
      const res = await calendar.calendarList.list();
      for (const item of res.data.items ?? []) {
        if (!item.id || seen.has(item.id)) continue;
        if (item.accessRole !== "owner") continue;
        seen.add(item.id);
        const emailTag = acc.email ? ` (${acc.email})` : " (추가 계정)";
        all.push({
          id: item.id,
          summary: `${item.summary || ""}${emailTag}`,
          backgroundColor: item.backgroundColor || "#4285f4",
          primary: false,
        });
      }
    } catch {
      // ignore
    }
  }

  return all;
}

/**
 * @param calendarIds Optional list of `calendars.id` (native UUIDs, unified).
 *   When provided, filters BOTH local events (by calendar_id) AND Google
 *   events (by resolving each native calendar's `google_calendar_id`).
 */
export async function getEvents(
  year: number,
  month: number,
  calendarIds?: string[],
): Promise<Event[]> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const startOfMonth = new Date(year, month, 1).toISOString();
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();

  // Resolve the user's calendars so we can translate the filter.
  const { data: allCalsData } = await db
    .from("calendars")
    .select("id, source, google_calendar_id")
    .eq("user_id", userId);
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

  // Local events (optionally filtered by calendar_id).
  let localQuery = db
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", startOfMonth)
    .lte("start_at", endOfMonth)
    .order("start_at", { ascending: true });
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
  const localEvents: Event[] = (localData ?? []).map((e: Record<string, unknown>) => ({
    ...e,
    source: "local" as const,
  })) as Event[];

  // Google Calendar events — only for the selected google-backed calendars.
  let googleEvents: Event[] = [];
  try {
    const calendar = await getAuthenticatedCalendar(userId);
    if (calendar) {
      const ids = hasExplicitFilter
        ? googleCalIdsToFetch
        : googleCalIdsToFetch.length > 0
          ? googleCalIdsToFetch
          : ["primary"];

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
            return res.data.items || [];
          } catch {
            return [];
          }
        })
      );

      googleEvents = allItems.flat().map((item) => ({
        id: `gcal_${item.id}`,
        title: item.summary || "(제목 없음)",
        description: item.description || null,
        start_at: item.start?.dateTime || item.start?.date || "",
        end_at: item.end?.dateTime || item.end?.date || "",
        all_day: !!item.start?.date,
        calendar_id: null,
        business_id: null,
        source: "google" as const,
        created_at: item.created || "",
        updated_at: item.updated || "",
      }));
    }
  } catch (err) {
    console.error("Google Calendar fetch error:", err);
  }

  // Merge and sort, deduplicate by id
  const seen = new Set<string>();
  const all = [...localEvents, ...googleEvents]
    .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return all;
}

export async function isGoogleCalendarConnected(): Promise<boolean> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("google_refresh_token")
    .eq("id", userId)
    .single();
  return !!data?.google_refresh_token;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const userId = await requireUserId();
  const db = getAdminClient();
  await db
    .from("users")
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function getEvent(id: string): Promise<Event | null> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data, error } = await db
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return { ...data, source: "local" } as Event;
}

export async function createEvent(input: EventInput): Promise<Event> {
  const userId = await requireUserId();
  const db = getAdminClient();

  // Resolve target calendar: explicit → default → null
  let calendarId = input.calendar_id ?? null;
  let targetCal: { source: "native" | "google"; google_calendar_id: string | null } | null = null;
  if (calendarId) {
    const { data: cal } = await db
      .from("calendars")
      .select("id, user_id, source, google_calendar_id")
      .eq("id", calendarId)
      .single();
    if (!cal || cal.user_id !== userId) throw new Error("선택한 캘린더에 권한이 없어요.");
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
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Sync to Google only when the target calendar is google-backed.
  if (targetCal?.source === "google" && targetCal.google_calendar_id) {
    try {
      const calendar = await getAuthenticatedCalendar(userId);
      if (calendar) {
        const event: Record<string, unknown> = {
          summary: input.title,
          description: input.description || undefined,
        };
        if (input.all_day) {
          event.start = { date: input.start_at.split("T")[0] };
          event.end = { date: input.end_at.split("T")[0] };
        } else {
          event.start = { dateTime: input.start_at, timeZone: "Asia/Seoul" };
          event.end = { dateTime: input.end_at, timeZone: "Asia/Seoul" };
        }
        await calendar.events.insert({
          calendarId: targetCal.google_calendar_id,
          requestBody: event,
        });
      }
    } catch {
      // Silently skip Google Calendar sync errors
    }
  }

  return { ...data, source: "local" } as Event;
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<Event> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, source: "local" } as Event;
}

export async function deleteEvent(id: string): Promise<void> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db
    .from("events")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Update a Google-owned event. We don't mirror Google events in our DB;
 * we just push the changes through the Calendar API.
 */
export async function updateGoogleEvent(
  gcalId: string,
  eventId: string,
  input: Partial<EventInput>,
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  const calendar = await getAuthenticatedCalendar(userId);
  if (!calendar) return { error: "Google 캘린더 연결이 필요해요." };
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.summary = input.title;
  if (input.description !== undefined) body.description = input.description ?? "";
  if (input.start_at !== undefined && input.end_at !== undefined) {
    if (input.all_day) {
      body.start = { date: input.start_at.split("T")[0] };
      body.end = { date: input.end_at.split("T")[0] };
    } else {
      body.start = { dateTime: input.start_at, timeZone: "Asia/Seoul" };
      body.end = { dateTime: input.end_at, timeZone: "Asia/Seoul" };
    }
  }
  try {
    await calendar.events.patch({
      calendarId: gcalId,
      eventId,
      requestBody: body,
    });
    return { ok: true };
  } catch (err) {
    console.error("updateGoogleEvent", err);
    return { error: "Google 일정 수정에 실패했어요. 권한이 있는지 확인해주세요." };
  }
}

export async function deleteGoogleEvent(
  gcalId: string,
  eventId: string,
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  const calendar = await getAuthenticatedCalendar(userId);
  if (!calendar) return { error: "Google 캘린더 연결이 필요해요." };
  try {
    await calendar.events.delete({ calendarId: gcalId, eventId });
    return { ok: true };
  } catch (err) {
    console.error("deleteGoogleEvent", err);
    return { error: "Google 일정 삭제에 실패했어요. 권한이 있는지 확인해주세요." };
  }
}

export async function fetchWeekDays(
  username: string,
  weekStartIso: string,
  calendarIds?: string[],
) {
  const { getProfileWeek } = await import("@/lib/profile-week");
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  return getProfileWeek(username, weekStart, weekEnd, calendarIds);
}
