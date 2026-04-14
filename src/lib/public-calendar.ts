import { getAdminClient } from "@/lib/supabase";
import { getAuthenticatedCalendar } from "@/lib/google";
import { getSession } from "@/lib/auth";
import { listVisibleCalendars } from "@/lib/calendars";
import { listNativeEventsInCalendars } from "@/lib/native-events";

export type PublicEvent = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  calendar_color: string;
  calendar_label: string;
};

/**
 * Returns events from a host's Google calendars that are visible to the
 * current viewer based on user_calendar_settings.
 *
 * Visibility rules:
 *   - public: anyone (including signed-out viewers)
 *   - followers: viewer must follow the host
 *   - private (default for unseen calendars): never returned
 */
export async function getPublicEvents(
  hostUsername: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<PublicEvent[]> {
  const db = getAdminClient();

  const { data: host } = await db
    .from("users")
    .select("id")
    .eq("username", hostUsername)
    .single();
  if (!host) return [];

  const session = await getSession();
  const isOwner = session?.username === hostUsername;
  let viewerFollows = false;
  if (session && !isOwner) {
    const { data: viewer } = await db
      .from("users")
      .select("id")
      .eq("username", session.username)
      .single();
    if (viewer) {
      const { data: f } = await db
        .from("follows")
        .select("id")
        .eq("follower_id", viewer.id)
        .eq("following_id", host.id)
        .maybeSingle();
      viewerFollows = !!f;
    }
  }

  const allowed: string[] = isOwner
    ? ["public", "followers", "private"]
    : viewerFollows
      ? ["public", "followers"]
      : ["public"];

  const { data: settings } = await db
    .from("user_calendar_settings")
    .select("google_calendar_id, visibility, label_override")
    .eq("user_id", host.id)
    .in("visibility", allowed);

  const allowedCals = (settings ?? []) as {
    google_calendar_id: string;
    visibility: string;
    label_override: string | null;
  }[];
  if (allowedCals.length === 0) return [];

  const calendar = await getAuthenticatedCalendar(host.id as string);
  if (!calendar) return [];

  // Pull color metadata once so we can color events by source calendar.
  let calendarMeta: Record<string, { summary: string; color: string }> = {};
  try {
    const list = await calendar.calendarList.list();
    for (const item of list.data.items ?? []) {
      if (item.id) {
        calendarMeta[item.id] = {
          summary: item.summary || item.id,
          color: item.backgroundColor || "#4285f4",
        };
      }
    }
  } catch {
    calendarMeta = {};
  }

  const all = await Promise.all(
    allowedCals.map(async (cs) => {
      try {
        const res = await calendar.events.list({
          calendarId: cs.google_calendar_id,
          timeMin: rangeStart.toISOString(),
          timeMax: rangeEnd.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 250,
        });
        const meta = calendarMeta[cs.google_calendar_id] ?? {
          summary: cs.google_calendar_id,
          color: "#4285f4",
        };
        const label = cs.label_override || meta.summary;
        return (res.data.items ?? []).map((it) => ({
          id: `${cs.google_calendar_id}::${it.id}`,
          title: it.summary || "(제목 없음)",
          start_at: it.start?.dateTime || it.start?.date || "",
          end_at: it.end?.dateTime || it.end?.date || "",
          all_day: !!it.start?.date,
          calendar_color: meta.color,
          calendar_label: label,
        })) as PublicEvent[];
      } catch {
        return [] as PublicEvent[];
      }
    }),
  );

  const googleEvents = all
    .flat()
    .filter((e) => e.start_at)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  // Native calendar events — visible when the calendar's visibility matches.
  const visibleCalendars = await listVisibleCalendars(hostUsername);
  const nativeCalendarIds = visibleCalendars
    .filter((c) => c.source === "native")
    .map((c) => c.id);
  const nativeRows = await listNativeEventsInCalendars(
    nativeCalendarIds,
    rangeStart,
    rangeEnd,
  );
  const nativeEvents: PublicEvent[] = nativeRows.map((e) => ({
    id: `native:${e.id}`,
    title: e.title,
    start_at: e.start_at,
    end_at: e.end_at ?? e.start_at,
    all_day: e.all_day,
    calendar_color: e.calendar_color,
    calendar_label: e.calendar_label,
  }));

  return [...googleEvents, ...nativeEvents].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
}
