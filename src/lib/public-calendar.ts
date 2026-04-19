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
  // Distinguish "undefined (no filter)" from "[] (explicit deselect all)".
  const hasExplicitFilter = Array.isArray(calendarIds);
  const filtered = hasExplicitFilter
    ? scoped.filter((c) => calendarIds!.includes(c.id))
    : scoped;
  if (hasExplicitFilter && filtered.length === 0) return [];
  if (filtered.length === 0 && !isOwner) return [];
  if (filtered.length === 0 && forPublicFeed) return [];

  // ── Google-backed calendars ──────────────────────────────────────────
  const googleBackedCals = filtered.filter(
    (c) => c.source === "google" && c.google_calendar_id,
  );

  const calendar = await getAuthenticatedCalendar(host.id as string);

  // Owner fallback: when a connected Google calendar hasn't been saved
  // into `calendars` yet, still show events from it. This is the only
  // reason we need to hit Google's `calendarList.list()` — skip the
  // roundtrip entirely when not applicable (e.g. explicit calendar filter,
  // public feed render, non-owner viewer).
  const ownerFallbackCals: Array<{
    id: string;
    google_calendar_id: string;
    name: string;
    color: string;
  }> = [];
  const needsMeta = !!calendar && isOwner && !forPublicFeed && !hasExplicitFilter;
  if (needsMeta) {
    try {
      const list = await calendar.calendarList.list();
      const linkedIds = new Set(
        googleBackedCals.map((c) => c.google_calendar_id as string),
      );
      for (const item of list.data.items ?? []) {
        if (!item.id) continue;
        if (item.accessRole !== "owner") continue;
        if (linkedIds.has(item.id)) continue;
        ownerFallbackCals.push({
          id: `gfallback:${item.id}`,
          google_calendar_id: item.id,
          name: item.summary || item.id,
          color: item.backgroundColor || "#4285f4",
        });
      }
    } catch {
      // ignore — fall through with no fallback calendars
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
            return (res.data.items ?? []).map((it) => ({
              id: `${cs.google_calendar_id}::${it.id}`,
              title: it.summary || "(제목 없음)",
              start_at: it.start?.dateTime || it.start?.date || "",
              end_at: it.end?.dateTime || it.end?.date || "",
              all_day: !!it.start?.date,
              calendar_color: cs.color,
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
