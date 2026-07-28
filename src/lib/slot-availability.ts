import { getAuthenticatedCalendar } from "@/lib/google";
import { getAdminClient } from "@/lib/supabase";
import { listLocationBuffers } from "@/lib/location-buffers";
import { resolveBufferForEvent } from "@/lib/location-buffers-types";

const TZ_OFFSET_MIN = 9 * 60; // Asia/Seoul
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type Day = (typeof DAYS)[number];

export type WorkingHours = Partial<Record<Day, { start: string; end: string }[]>>;

export type AutoSlotOption = {
  start_at: string;
  end_at: string;
  /** Seats left at this time (capacity minus same-slot bookings). */
  remaining: number;
};

type AutoSpec = {
  duration_min: number;
  slot_interval_min: number;
  working_hours: WorkingHours;
  min_notice_hours: number;
  max_advance_days: number;
  buffer_min: number;
  /** The slot's own location/title — when the adjacent event shares
   * the same location preset, the travel buffer is skipped. */
  slot_title?: string | null;
  slot_location?: string | null;
  /** When set with capacity > 1, bookings of THIS slot at the exact
   * same time consume seats instead of closing the time entirely
   * (group sessions). */
  slot_id?: string | null;
  capacity?: number;
};

type Block = {
  start: Date;
  end: Date;
  title: string | null;
  location: string | null;
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

  // Location presets drive per-event travel buffers (e.g. 강남 30m,
  // 여의도 60m, 부산 180m). Falls back to spec.buffer_min.
  const presets = await listLocationBuffers(hostId).catch(() => []);

  // 1. Pull Google primary events — switched from freebusy.query so we
  // also get title + location for per-event buffer matching.
  let googleBlocks: Block[] = [];
  try {
    const calendar = await getAuthenticatedCalendar(hostId);
    if (calendar) {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: horizon.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 500,
      });
      for (const it of res.data.items ?? []) {
        if (it.status === "cancelled") continue;
        const selfAttendee = (it.attendees ?? []).find((a) => a.self);
        if (selfAttendee?.responseStatus === "declined") continue;
        if (it.transparency === "transparent") continue; // "Available" events
        const startIso = it.start?.dateTime || it.start?.date;
        const endIso = it.end?.dateTime || it.end?.date;
        if (!startIso || !endIso) continue;
        // Skip all-day events — they would block the entire day.
        if (it.start?.date && !it.start?.dateTime) continue;
        const start = new Date(startIso);
        const end = new Date(endIso);
        if (end.getTime() <= start.getTime()) continue;
        // 일정에 이동시간이 설정돼 있으면 그만큼 시작 전을 함께 막는다.
        const travelMin = Number(
          it.extendedProperties?.private?.orbit42TravelMin ?? 0,
        );
        googleBlocks.push({
          start:
            Number.isFinite(travelMin) && travelMin > 0
              ? new Date(start.getTime() - travelMin * 60_000)
              : start,
          end,
          title: (it.summary as string | null) ?? null,
          location: (it.location as string | null) ?? null,
        });
      }
    }
  } catch {
    googleBlocks = [];
  }

  // 2. Pull existing bookings for this host so two guests don't double-book.
  // Join the slot so each booking carries its own location/title — that
  // way back-to-back bookings at the same location don't force a buffer.
  const db = getAdminClient();
  const { data: existing } = await db
    .from("bookings")
    .select(
      "slot_id, scheduled_at, scheduled_end_at, status, selected_location, slot:time_slots!bookings_slot_id_fkey(title, location_detail)",
    )
    .eq("host_id", hostId)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizon.toISOString())
    .neq("status", "canceled");
  const existingRows = (existing ?? []) as unknown as Array<{
    slot_id: string;
    scheduled_at: string;
    scheduled_end_at: string;
    selected_location: string | null;
    slot: { title: string | null; location_detail: string | null } | null;
  }>;

  // Group slots: bookings of this same slot at the same start time
  // share the seat count instead of blocking each other.
  const capacity = Math.max(1, spec.capacity ?? 1);
  const groupable = !!spec.slot_id && capacity > 1;
  const sameSlotStartCounts = new Map<string, number>();
  const sameSlotBlocks: { start: Date; end: Date }[] = [];
  const bookedBlocks: Block[] = [];
  for (const b of existingRows) {
    if (groupable && b.slot_id === spec.slot_id) {
      const start = new Date(b.scheduled_at);
      const key = start.toISOString();
      sameSlotStartCounts.set(key, (sameSlotStartCounts.get(key) ?? 0) + 1);
      sameSlotBlocks.push({ start, end: new Date(b.scheduled_end_at) });
      continue;
    }
    bookedBlocks.push({
      start: new Date(b.scheduled_at),
      end: new Date(b.scheduled_end_at),
      title: b.slot?.title ?? null,
      location: b.selected_location ?? b.slot?.location_detail ?? null,
    });
  }

  // 3. Pull host's native (in-app) calendar events — if the host creates
  // an event during a would-be-bookable window, the slot should close.
  const { data: nativeEvents } = await db
    .from("events")
    .select("title, start_at, end_at, all_day, travel_min")
    .eq("user_id", hostId)
    .gte("start_at", now.toISOString())
    .lte("start_at", horizon.toISOString());
  const nativeBlocks: Block[] = (nativeEvents ?? [])
    .filter((e) => !e.all_day)
    .map((e) => {
      const start = new Date(e.start_at as string);
      const travelMin = Number(e.travel_min ?? 0);
      return {
        // 이동시간이 있으면 그만큼 시작 전을 함께 막는다.
        start:
          Number.isFinite(travelMin) && travelMin > 0
            ? new Date(start.getTime() - travelMin * 60_000)
            : start,
        end: new Date((e.end_at ?? e.start_at) as string),
        title: (e.title as string | null) ?? null,
        location: null,
      };
    })
    .filter((b) => b.end.getTime() > b.start.getTime());

  // If the slot itself has a location that matches a preset, a block
  // with the same preset needs no travel buffer — you're already there.
  const slotPreset = resolveBufferForEvent(presets, {
    location: spec.slot_location,
    title: spec.slot_title,
  });

  // Precompute buffer per block once (resolve against location presets).
  const blocks = [...googleBlocks, ...bookedBlocks, ...nativeBlocks].map(
    (b) => {
      const hit = resolveBufferForEvent(presets, {
        location: b.location,
        title: b.title,
      });
      const sameAsSlot = slotPreset && hit && hit.id === slotPreset.id;
      const bufMin = sameAsSlot
        ? 0
        : hit
          ? hit.buffer_min
          : spec.buffer_min;
      return { ...b, bufferMs: bufMin * 60_000 };
    },
  );

  // 4. Generate candidate options day by day.
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
            cur.getTime() < b.end.getTime() + b.bufferMs &&
            end.getTime() + b.bufferMs > b.start.getTime(),
        );
        // Group slots: an existing session of this slot at the exact
        // same time consumes seats; at any other overlapping time it
        // blocks like a normal busy block.
        const seatsTaken = sameSlotStartCounts.get(cur.toISOString()) ?? 0;
        const groupOverlap = sameSlotBlocks.some(
          (b) =>
            b.start.getTime() !== cur.getTime() &&
            cur.getTime() < b.end.getTime() &&
            end.getTime() > b.start.getTime(),
        );
        const full = seatsTaken >= capacity;
        if (!isPast && !conflicts && !groupOverlap && !full) {
          options.push({
            start_at: cur.toISOString(),
            end_at: end.toISOString(),
            remaining: capacity - seatsTaken,
          });
        }
        cur = new Date(cur.getTime() + spec.slot_interval_min * 60_000);
      }
    }
    // Safety cap to keep server memory bounded on misconfigured slots
    // (e.g. 365 days × 30-min intervals × 24h = 17,520 options). Higher
    // than before so long working hours + long validity still return
    // the full range.
    if (options.length >= 5000) break;
  }

  return options;
}
