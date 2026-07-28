"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import {
  getAuthenticatedCalendar,
  listExtraGoogleAccounts,
  getCalendarForExtraAccount,
} from "@/lib/google";
import {
  listEventsForUser,
  createEventForUser,
} from "@/lib/calendar-events";

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
  tentative: boolean;
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
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  travel_min?: number | null;
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
  return listEventsForUser(userId, year, month, calendarIds);
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
  return createEventForUser(userId, input);
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
  if (input.location !== undefined) body.location = input.location ?? "";
  if (
    input.location_lat !== undefined ||
    input.location_lng !== undefined ||
    input.travel_min !== undefined
  ) {
    // 좌표·이동시간은 extendedProperties 로 왕복 — 해제 시 빈 문자열로 덮는다.
    const privateProps: Record<string, string> = {};
    if (input.location_lat !== undefined || input.location_lng !== undefined) {
      privateProps.orbit42Lat =
        input.location_lat != null ? String(input.location_lat) : "";
      privateProps.orbit42Lng =
        input.location_lng != null ? String(input.location_lng) : "";
    }
    if (input.travel_min !== undefined) {
      privateProps.orbit42TravelMin =
        input.travel_min != null && input.travel_min > 0
          ? String(input.travel_min)
          : "";
    }
    body.extendedProperties = { private: privateProps };
  }
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
