"use server";

import { getAdminClient } from "@/lib/supabase";
import { getUserId } from "@/lib/db";
import { getAuthenticatedCalendar } from "@/lib/google";

type Span = { start: number; end: number };

/**
 * Mutual free-time matching (v1): given a host's bookable options,
 * return the option start times where the VIEWER is busy — from their
 * Google primary calendar, their own bookings (either side), and
 * native events. Returns null when not logged in.
 */
export async function findMyConflicts(
  options: { start_at: string; end_at: string }[],
): Promise<string[] | null> {
  const userId = await getUserId().catch(() => null);
  if (!userId) return null;
  if (options.length === 0) return [];

  const capped = options.slice(0, 1000);
  let min = Infinity;
  let max = -Infinity;
  for (const o of capped) {
    const s = new Date(o.start_at).getTime();
    const e = new Date(o.end_at).getTime();
    if (s < min) min = s;
    if (e > max) max = e;
  }
  const rangeStart = new Date(min);
  const rangeEnd = new Date(max);

  const busy: Span[] = [];
  const db = getAdminClient();

  // Google primary calendar.
  try {
    const calendar = await getAuthenticatedCalendar(userId);
    if (calendar) {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 500,
      });
      for (const it of res.data.items ?? []) {
        if (it.status === "cancelled") continue;
        const selfAttendee = (it.attendees ?? []).find((a) => a.self);
        if (selfAttendee?.responseStatus === "declined") continue;
        if (it.transparency === "transparent") continue;
        if (it.start?.date && !it.start?.dateTime) continue; // all-day
        const s = it.start?.dateTime ? new Date(it.start.dateTime) : null;
        const e = it.end?.dateTime ? new Date(it.end.dateTime) : null;
        if (!s || !e || e <= s) continue;
        busy.push({ start: s.getTime(), end: e.getTime() });
      }
    }
  } catch {
    // No Google connection — fall through to in-app sources.
  }

  // My bookings, on either side of the table.
  const { data: bookings } = await db
    .from("bookings")
    .select("scheduled_at, scheduled_end_at, status")
    .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
    .neq("status", "canceled")
    .gte("scheduled_at", rangeStart.toISOString())
    .lte("scheduled_at", rangeEnd.toISOString());
  for (const b of bookings ?? []) {
    busy.push({
      start: new Date(b.scheduled_at as string).getTime(),
      end: new Date(b.scheduled_end_at as string).getTime(),
    });
  }

  // Native calendar events.
  const { data: events } = await db
    .from("events")
    .select("start_at, end_at, all_day")
    .eq("user_id", userId)
    .gte("start_at", rangeStart.toISOString())
    .lte("start_at", rangeEnd.toISOString());
  for (const e of events ?? []) {
    if (e.all_day) continue;
    const s = new Date(e.start_at as string).getTime();
    const eEnd = new Date((e.end_at ?? e.start_at) as string).getTime();
    if (eEnd > s) busy.push({ start: s, end: eEnd });
  }

  const conflicts: string[] = [];
  for (const o of capped) {
    const s = new Date(o.start_at).getTime();
    const e = new Date(o.end_at).getTime();
    if (busy.some((b) => s < b.end && e > b.start)) {
      conflicts.push(o.start_at);
    }
  }
  return conflicts;
}
