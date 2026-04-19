import { getAdminClient } from "@/lib/supabase";
import {
  getAuthenticatedCalendar,
  listExtraGoogleAccounts,
  getCalendarForExtraAccount,
} from "@/lib/google";
import {
  type CalendarPurpose,
  type PurposeGroup,
  PURPOSE_OPTIONS,
  purposeGroup,
} from "@/lib/calendar-settings-types";
import {
  DEFAULT_WORK_HOURS,
  WORK_DAY_LABEL,
  type WorkDay,
  type WorkHours,
} from "@/lib/insights-types";

export { DEFAULT_WORK_HOURS, WORK_DAY_LABEL };
export type { WorkDay, WorkHours };

const TZ_OFFSET_MIN = 9 * 60; // Asia/Seoul (aligns with slot-availability.ts)
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const PURPOSE_LABEL: Record<CalendarPurpose, string> = Object.fromEntries(
  PURPOSE_OPTIONS.map((p) => [p.value, p.label]),
) as Record<CalendarPurpose, string>;

export type TimeBlock = {
  start: Date;
  end: Date;
  purpose: CalendarPurpose | null;
  calendar_id: string;
  calendar_name: string;
  calendar_color: string;
  all_day: boolean;
};

export type CategoryStat = {
  purpose: CalendarPurpose | "null";
  label: string;
  hours: number;
  group: PurposeGroup;
};

export type InsightsRange = {
  range_start: string;
  range_end: string;
  scheduled_hours: number;
  all_day_events: number;
  working_hours_total: number;
  working_hours_busy: number;
  working_hours_free: number;
  by_purpose: CategoryStat[];
  by_group: Record<PurposeGroup, number>;
};

export type WeeklyPoint = {
  week_start: string; // ISO date (Mon)
  by_group: Record<PurposeGroup, number>;
  scheduled_hours: number;
};

function parseHM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/** UTC Date representing a local (Asia/Seoul) wall-clock moment. */
function makeUtc(year: number, month: number, day: number, h: number, mi: number) {
  return new Date(Date.UTC(year, month, day, h, mi) - TZ_OFFSET_MIN * 60_000);
}

function tzDayInfo(d: Date) {
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    weekday: local.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
  };
}

/** Monday-anchored week start at 00:00 Asia/Seoul. */
export function weekStartMonday(d: Date): Date {
  const info = tzDayInfo(d);
  const delta = (info.weekday + 6) % 7; // Sun=0 → 6, Mon=1 → 0, ...
  return makeUtc(info.year, info.month, info.day - delta, 0, 0);
}

/** Union of overlap durations of [a,b] with any interval in ranges, in ms. */
function overlapMs(a: Date, b: Date, ranges: { start: Date; end: Date }[]): number {
  let total = 0;
  for (const r of ranges) {
    const s = Math.max(a.getTime(), r.start.getTime());
    const e = Math.min(b.getTime(), r.end.getTime());
    if (e > s) total += e - s;
  }
  return total;
}

/** Merge overlapping time ranges into a union. */
function mergeRanges(
  ranges: { start: Date; end: Date }[],
): { start: Date; end: Date }[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort(
    (x, y) => x.start.getTime() - y.start.getTime(),
  );
  const out: { start: Date; end: Date }[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), cur.end.getTime()));
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Expand the user's work_hours config into concrete time windows in a range. */
export function expandWorkingWindows(
  hours: WorkHours,
  rangeStart: Date,
  rangeEnd: Date,
): { start: Date; end: Date }[] {
  const windows: { start: Date; end: Date }[] = [];
  const info = tzDayInfo(rangeStart);
  const dayCount = Math.ceil(
    (rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60_000),
  ) + 1;
  for (let i = 0; i < dayCount; i++) {
    const target = new Date(
      Date.UTC(info.year, info.month, info.day + i),
    );
    const t = tzDayInfo(target);
    const dow = DAYS[t.weekday];
    const spec = hours[dow];
    if (!spec) continue;
    const sp = parseHM(spec.start);
    const ep = parseHM(spec.end);
    if (!sp || !ep) continue;
    const s = makeUtc(t.year, t.month, t.day, sp.h, sp.m);
    const e = makeUtc(t.year, t.month, t.day, ep.h, ep.m);
    const clipStart = new Date(Math.max(s.getTime(), rangeStart.getTime()));
    const clipEnd = new Date(Math.min(e.getTime(), rangeEnd.getTime()));
    if (clipEnd > clipStart) windows.push({ start: clipStart, end: clipEnd });
  }
  return windows;
}

/** Load this user's calendars as a map id → meta. */
async function loadCalendarIndex(userId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("calendars")
    .select("id, name, color, purpose, source, google_calendar_id, google_account_id")
    .eq("user_id", userId);
  type Row = {
    id: string;
    name: string;
    color: string;
    purpose: CalendarPurpose | null;
    source: "native" | "google";
    google_calendar_id: string | null;
    google_account_id: string | null;
  };
  return (data ?? []) as Row[];
}

/** Fetch every event in [start, end] for the user across native + google calendars. */
export async function fetchTimeBlocks(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<TimeBlock[]> {
  const db = getAdminClient();
  const cals = await loadCalendarIndex(userId);
  const calById = new Map(cals.map((c) => [c.id, c]));

  // ── Native events ────────────────────────────────────────────
  const { data: native } = await db
    .from("events")
    .select("id, calendar_id, title, start_at, end_at, all_day")
    .eq("user_id", userId)
    .gte("start_at", rangeStart.toISOString())
    .lte("start_at", rangeEnd.toISOString());

  const blocks: TimeBlock[] = [];
  for (const e of (native ?? []) as Array<{
    calendar_id: string | null;
    start_at: string;
    end_at: string | null;
    all_day: boolean;
  }>) {
    const cal = e.calendar_id ? calById.get(e.calendar_id) : null;
    const start = new Date(e.start_at);
    const end = new Date(e.end_at || e.start_at);
    if (end.getTime() <= start.getTime() && !e.all_day) continue;
    blocks.push({
      start,
      end,
      all_day: e.all_day,
      purpose: cal?.purpose ?? null,
      calendar_id: cal?.id ?? "(none)",
      calendar_name: cal?.name ?? "내 캘린더",
      calendar_color: cal?.color ?? "#6366f1",
    });
  }

  // ── Google events, grouped by the account that owns each calendar ──
  const googleCals = cals.filter(
    (c) => c.source === "google" && !!c.google_calendar_id,
  );
  if (googleCals.length > 0) {
    const primaryCal = await getAuthenticatedCalendar(userId);
    const extras = await listExtraGoogleAccounts(userId);
    const extraCals = await Promise.all(
      extras.map(async (acc) => ({
        accountId: acc.id,
        calendar: await getCalendarForExtraAccount(acc),
      })),
    );
    const extraById = new Map(extraCals.map((e) => [e.accountId, e.calendar]));

    await Promise.all(
      googleCals.map(async (cal) => {
        const client = cal.google_account_id
          ? extraById.get(cal.google_account_id) ?? primaryCal
          : primaryCal;
        if (!client) return;
        try {
          const res = await client.events.list({
            calendarId: cal.google_calendar_id as string,
            timeMin: rangeStart.toISOString(),
            timeMax: rangeEnd.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 500,
          });
          for (const it of res.data.items ?? []) {
            // Skip declined events so they don't inflate busy/work totals.
            const selfAttendee = (it.attendees ?? []).find((a) => a.self);
            if (selfAttendee?.responseStatus === "declined") continue;
            if (it.status === "cancelled") continue;
            const startIso = it.start?.dateTime || it.start?.date;
            const endIso = it.end?.dateTime || it.end?.date;
            if (!startIso || !endIso) continue;
            const allDay = !!it.start?.date;
            const start = new Date(startIso);
            const end = new Date(endIso);
            if (!allDay && end.getTime() <= start.getTime()) continue;
            blocks.push({
              start,
              end,
              all_day: allDay,
              purpose: cal.purpose,
              calendar_id: cal.id,
              calendar_name: cal.name,
              calendar_color: cal.color,
            });
          }
        } catch {
          // ignore a single calendar's fetch error
        }
      }),
    );
  }

  return blocks;
}

/** Summarize blocks within [rangeStart, rangeEnd] according to work hours. */
export function summarizeBlocks(
  blocks: TimeBlock[],
  rangeStart: Date,
  rangeEnd: Date,
  workHours: WorkHours,
): InsightsRange {
  const timed = blocks.filter((b) => !b.all_day);
  const allDayCount = blocks.filter((b) => b.all_day).length;

  // Clip every block to the range.
  const clipped = timed
    .map((b) => ({
      start: new Date(Math.max(b.start.getTime(), rangeStart.getTime())),
      end: new Date(Math.min(b.end.getTime(), rangeEnd.getTime())),
      purpose: b.purpose,
    }))
    .filter((b) => b.end.getTime() > b.start.getTime());

  // By purpose (hours).
  const byPurposeMs = new Map<CalendarPurpose | "null", number>();
  let totalMs = 0;
  for (const b of clipped) {
    const dur = b.end.getTime() - b.start.getTime();
    totalMs += dur;
    const key: CalendarPurpose | "null" = b.purpose ?? "null";
    byPurposeMs.set(key, (byPurposeMs.get(key) ?? 0) + dur);
  }

  const byPurpose: CategoryStat[] = Array.from(byPurposeMs.entries())
    .map(([purpose, ms]) => {
      const hours = ms / 3_600_000;
      const isNull = purpose === "null";
      return {
        purpose,
        label: isNull ? "미분류" : PURPOSE_LABEL[purpose as CalendarPurpose],
        hours,
        group: isNull ? ("other" as PurposeGroup) : purposeGroup(purpose as CalendarPurpose),
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const byGroup: Record<PurposeGroup, number> = { work: 0, personal: 0, other: 0 };
  for (const c of byPurpose) byGroup[c.group] += c.hours;

  // Working-hours coverage.
  const windows = expandWorkingWindows(workHours, rangeStart, rangeEnd);
  const workingMs = windows.reduce(
    (sum, w) => sum + (w.end.getTime() - w.start.getTime()),
    0,
  );
  const mergedBusy = mergeRanges(
    clipped.map((b) => ({ start: b.start, end: b.end })),
  );
  const busyInWorkMs = windows.reduce(
    (sum, w) => sum + overlapMs(w.start, w.end, mergedBusy),
    0,
  );

  return {
    range_start: rangeStart.toISOString(),
    range_end: rangeEnd.toISOString(),
    scheduled_hours: totalMs / 3_600_000,
    all_day_events: allDayCount,
    working_hours_total: workingMs / 3_600_000,
    working_hours_busy: busyInWorkMs / 3_600_000,
    working_hours_free: Math.max(0, (workingMs - busyInWorkMs) / 3_600_000),
    by_purpose: byPurpose,
    by_group: byGroup,
  };
}

export async function getWeekInsights(
  userId: string,
  weekStart: Date,
  workHours: WorkHours,
): Promise<InsightsRange> {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  const blocks = await fetchTimeBlocks(userId, weekStart, weekEnd);
  return summarizeBlocks(blocks, weekStart, weekEnd, workHours);
}

/** Coarse weekly trend — fetches one big range then slices locally. */
export async function getWeeklyTrend(
  userId: string,
  weeks: number,
  workHours: WorkHours,
  anchor: Date = new Date(),
): Promise<WeeklyPoint[]> {
  const latestStart = weekStartMonday(anchor);
  const earliestStart = new Date(
    latestStart.getTime() - (weeks - 1) * 7 * 24 * 60 * 60_000,
  );
  const rangeEnd = new Date(latestStart.getTime() + 7 * 24 * 60 * 60_000);
  const blocks = await fetchTimeBlocks(userId, earliestStart, rangeEnd);

  const points: WeeklyPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const ws = new Date(earliestStart.getTime() + i * 7 * 24 * 60 * 60_000);
    const we = new Date(ws.getTime() + 7 * 24 * 60 * 60_000);
    const slice = blocks.filter(
      (b) =>
        b.start.getTime() < we.getTime() && b.end.getTime() > ws.getTime(),
    );
    const summary = summarizeBlocks(slice, ws, we, workHours);
    points.push({
      week_start: ws.toISOString(),
      by_group: summary.by_group,
      scheduled_hours: summary.scheduled_hours,
    });
  }
  return points;
}

/** Persist / load a user's work_hours. */
export async function getWorkHours(userId: string): Promise<WorkHours> {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("work_hours")
    .eq("id", userId)
    .single();
  const stored = (data?.work_hours ?? null) as WorkHours | null;
  if (!stored || Object.keys(stored).length === 0) return DEFAULT_WORK_HOURS;
  return stored;
}

export async function saveWorkHours(userId: string, hours: WorkHours) {
  const db = getAdminClient();
  const sanitized: WorkHours = {};
  for (const d of DAYS) {
    const w = hours[d];
    if (!w) continue;
    const s = parseHM(w.start);
    const e = parseHM(w.end);
    if (!s || !e) continue;
    if (e.h * 60 + e.m <= s.h * 60 + s.m) continue;
    sanitized[d] = { start: w.start, end: w.end };
  }
  await db
    .from("users")
    .update({ work_hours: sanitized, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return sanitized;
}
