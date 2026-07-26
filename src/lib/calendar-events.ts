/**
 * Calendar event listing/creation, keyed by an explicit userId.
 *
 * Extracted from app/[username]/calendar/actions.ts so both the web server
 * actions (cookie session) and the mobile /api/v1 routes (bearer token) share
 * one implementation. Callers are responsible for resolving a trusted userId.
 */

import { getAdminClient } from "@/lib/supabase";
import { getAuthenticatedCalendar } from "@/lib/google";

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
};

export type CalendarEventInput = {
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  business_id?: string | null;
  calendar_id?: string | null;
};

/**
 * Local + Google events for one month, merged and sorted.
 * @param month 0-based (JS Date convention), matching the existing web action.
 * @param calendarIds Optional list of `calendars.id` (native UUIDs, unified).
 *   When provided, filters BOTH local events (by calendar_id) AND Google
 *   events (by resolving each native calendar's `google_calendar_id`).
 */
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
  const localEvents: CalendarEvent[] = (localData ?? []).map(
    (e: Record<string, unknown>) => ({
      ...e,
      source: "local" as const,
    }),
  ) as CalendarEvent[];

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
    if (!cal || cal.user_id !== userId) {
      throw new Error("선택한 캘린더에 권한이 없어요.");
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

  return { ...data, source: "local" } as CalendarEvent;
}
