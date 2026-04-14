import { getAuthenticatedCalendar } from "@/lib/google";
import { getAdminClient } from "@/lib/supabase";

const TZ_OFFSET_MIN = 9 * 60; // Asia/Seoul
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type Day = (typeof DAYS)[number];

export type WorkingHours = Partial<Record<Day, { start: string; end: string }[]>>;

export type AutoSlotOption = {
  start_at: string;
  end_at: string;
};

type AutoSpec = {
  duration_min: number;
  slot_interval_min: number;
  working_hours: WorkingHours;
  min_notice_hours: number;
  max_advance_days: number;
  buffer_min: number;
};

function parseHM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/** Build a UTC Date from a Y-M-D + HH:mm interpreted in TZ_OFFSET. */
function makeUtc(year: number, month: number, day: number, h: number, mi: number) {
  const ms = Date.UTC(year, month, day, h, mi) - TZ_OFFSET_MIN * 60_000;
  return new Date(ms);
}

/** Get the day-of-week index in the configured TZ for a UTC date. */
function tzDayInfo(d: Date) {
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    weekday: local.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
  };
}

/** Return generated bookable options for an auto slot. */
export async function computeAutoAvailability(
  hostId: string,
  spec: AutoSpec,
): Promise<AutoSlotOption[]> {
  const now = new Date();
  const earliest = new Date(now.getTime() + spec.min_notice_hours * 60 * 60_000);
  const horizon = new Date(now.getTime() + spec.max_advance_days * 24 * 60 * 60_000);

  // 1. Pull Google busy windows for the entire horizon (best-effort).
  let busy: { start: Date; end: Date }[] = [];
  try {
    const calendar = await getAuthenticatedCalendar(hostId);
    if (calendar) {
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: horizon.toISOString(),
          items: [{ id: "primary" }],
        },
      });
      busy = (res.data.calendars?.primary?.busy || []).map((b) => ({
        start: new Date(b.start || ""),
        end: new Date(b.end || ""),
      }));
    }
  } catch {
    busy = [];
  }

  // 2. Pull existing bookings for this host so two guests don't double-book.
  const db = getAdminClient();
  const { data: existing } = await db
    .from("bookings")
    .select("scheduled_at, scheduled_end_at, status")
    .eq("host_id", hostId)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizon.toISOString())
    .neq("status", "canceled");
  const booked = (existing ?? []).map((b) => ({
    start: new Date(b.scheduled_at as string),
    end: new Date(b.scheduled_end_at as string),
  }));

  const blocks = [...busy, ...booked];

  // 3. Generate candidate options day by day.
  const options: AutoSlotOption[] = [];
  const cursor = tzDayInfo(now);
  for (let dayOffset = 0; dayOffset <= spec.max_advance_days; dayOffset++) {
    const target = new Date(
      Date.UTC(cursor.year, cursor.month, cursor.day + dayOffset),
    );
    const info = tzDayInfo(target);
    const dow = DAYS[info.weekday];
    const ranges = spec.working_hours[dow];
    if (!ranges || ranges.length === 0) continue;

    for (const range of ranges) {
      const startHM = parseHM(range.start);
      const endHM = parseHM(range.end);
      if (!startHM || !endHM) continue;

      const dayStart = makeUtc(info.year, info.month, info.day, startHM.h, startHM.m);
      const dayEnd = makeUtc(info.year, info.month, info.day, endHM.h, endHM.m);

      let cur = dayStart;
      while (cur.getTime() + spec.duration_min * 60_000 <= dayEnd.getTime()) {
        const end = new Date(cur.getTime() + spec.duration_min * 60_000);
        const isPast = cur < earliest;
        const conflicts = blocks.some(
          (b) =>
            cur.getTime() < b.end.getTime() + spec.buffer_min * 60_000 &&
            end.getTime() + spec.buffer_min * 60_000 > b.start.getTime(),
        );
        if (!isPast && !conflicts) {
          options.push({ start_at: cur.toISOString(), end_at: end.toISOString() });
        }
        cur = new Date(cur.getTime() + spec.slot_interval_min * 60_000);
      }
    }
    if (options.length >= 60) break; // cap output
  }

  return options;
}
