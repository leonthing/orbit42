"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import { getAuthenticatedCalendar } from "@/lib/google";

export type Event = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  business_id: string | null;
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
};

export type GoogleCalendarInfo = {
  id: string;
  summary: string;
  backgroundColor: string;
  primary: boolean;
};

export async function getGoogleCalendars(): Promise<GoogleCalendarInfo[]> {
  const userId = await requireUserId();
  const calendar = await getAuthenticatedCalendar(userId);
  if (!calendar) return [];

  try {
    const res = await calendar.calendarList.list();
    return (res.data.items || []).map((item) => ({
      id: item.id || "",
      summary: item.summary || "",
      backgroundColor: item.backgroundColor || "#4285f4",
      primary: !!item.primary,
    }));
  } catch {
    return [];
  }
}

export async function getEvents(
  year: number,
  month: number,
  calendarIds?: string[],
): Promise<Event[]> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const startOfMonth = new Date(year, month, 1).toISOString();
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();

  // Local events
  const { data: localData } = await db
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", startOfMonth)
    .lte("start_at", endOfMonth)
    .order("start_at", { ascending: true });

  const localEvents: Event[] = (localData ?? []).map((e: Record<string, unknown>) => ({
    ...e,
    source: "local" as const,
  })) as Event[];

  // Google Calendar events
  let googleEvents: Event[] = [];
  try {
    const calendar = await getAuthenticatedCalendar(userId);
    if (calendar) {
      const ids = calendarIds && calendarIds.length > 0 ? calendarIds : ["primary"];

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

  const { data, error } = await db
    .from("events")
    .insert({
      user_id: userId,
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

  // Also create on Google Calendar if connected
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
      await calendar.events.insert({ calendarId: "primary", requestBody: event });
    }
  } catch {
    // Silently skip Google Calendar sync errors
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
