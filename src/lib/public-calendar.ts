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
/**
 * @param calendarIds Optional list of `calendars.id` (unified native/google).
 * @param forPublicFeed When true, returns ONLY events from calendars whose
 *   visibility is "public" — regardless of viewer being the owner. Use this
 *   for feed integration so private/followers calendars never leak into the
 *   global feed, even for the calendar owner.
 */
export async function getPublicEvents(
  hostUsername: string,
  rangeStart: Date,
  rangeEnd: Date,
  calendarIds?: string[],
  forPublicFeed = false,
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

  const visibleCalendars = await listVisibleCalendars(hostUsername);
  const scoped = forPublicFeed
    ? visibleCalendars.filter((c) => c.visibility === "public")
    : visibleCalendars;
  const filtered =
    calendarIds && calendarIds.length > 0
      ? scoped.filter((c) => calendarIds.includes(c.id))
      : scoped;
  if (filtered.length === 0 && !isOwner) return [];
  // When scoped to public feed, disable the owner-fallback too.
  if (filtered.length === 0 && forPublicFeed) return [];

  // ── Google-backed calendars ──────────────────────────────────────────
  const googleBackedCals = filtered.filter(
    (c) => c.source === "google" && c.google_calendar_id,
  );

  // Owner fallback: when a connected Google calendar hasn't been saved
  // into `calendars` yet, still show events from it.
  const ownerFallbackCals: Array<{
    id: string;
    google_calendar_id: string;
    name: string;
    color: string;
  }> = [];
  const calendar = await getAuthenticatedCalendar(host.id as string);
  let calendarMeta: Record<string, { summary: string; color: string }> = {};
  if (calendar) {
    try {
      const list = await calendar.calendarList.list();
      for (const item of list.data.items ?? []) {
        if (!item.id) continue;
        if (item.accessRole !== "owner") continue;
        calendarMeta[item.id] = {
          summary: item.summary || item.id,
          color: item.backgroundColor || "#4285f4",
        };
      }
    } catch {
      calendarMeta = {};
    }
    if (isOwner && !forPublicFeed && (!calendarIds || calendarIds.length === 0)) {
      const linkedIds = new Set(
        googleBackedCals.map((c) => c.google_calendar_id as string),
      );
      for (const [gid, meta] of Object.entries(calendarMeta)) {
        if (!linkedIds.has(gid)) {
          ownerFallbackCals.push({
            id: `gfallback:${gid}`,
            google_calendar_id: gid,
            name: meta.summary,
            color: meta.color,
          });
        }
      }
    }
  }

  const googleFetchables = [
    ...googleBackedCals.map((c) => ({
      rowId: c.id,
      google_calendar_id: c.google_calendar_id as string,
      name: c.name,
      color: c.color,
    })),
    ...ownerFallbackCals,
  ];

  const googleResults = calendar
    ? await Promise.all(
        googleFetchables.map(async (cs) => {
          try {
            const res = await calendar.events.list({
              calendarId: cs.google_calendar_id,
              timeMin: rangeStart.toISOString(),
              timeMax: rangeEnd.toISOString(),
              singleEvents: true,
              orderBy: "startTime",
              maxResults: 250,
            });
            const meta = calendarMeta[cs.google_calendar_id];
            const color = meta?.color || cs.color;
            return (res.data.items ?? []).map((it) => ({
              id: `${cs.google_calendar_id}::${it.id}`,
              title: it.summary || "(제목 없음)",
              start_at: it.start?.dateTime || it.start?.date || "",
              end_at: it.end?.dateTime || it.end?.date || "",
              all_day: !!it.start?.date,
              calendar_color: color,
              calendar_label: cs.name,
            })) as PublicEvent[];
          } catch {
            return [] as PublicEvent[];
          }
        }),
      )
    : [];

  const googleEvents = googleResults
    .flat()
    .filter((e) => e.start_at)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  // ── Native calendar events ───────────────────────────────────────────
  const nativeCalendarIds = filtered
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
