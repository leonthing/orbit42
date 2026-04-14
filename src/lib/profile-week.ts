import { listPublicSlotsByUsername, getBookableOptions } from "@/lib/slots";
import { getPublicEvents } from "@/lib/public-calendar";

export type WeekItem =
  | {
      kind: "event";
      id: string;
      start_at: string;
      end_at: string;
      all_day: boolean;
      title: string;
      color: string;
    }
  | {
      kind: "slot";
      id: string;
      slot_id: string;
      slot_slug: string;
      start_at: string;
      end_at: string;
      title: string;
      price_cents: number;
      duration_min: number;
    };

export type WeekDay = {
  date: Date;
  isToday: boolean;
  items: WeekItem[];
};

/**
 * Fetch a unified week-long view for a profile: public events from
 * Google, plus any bookable slot windows in the same range.
 */
export async function getProfileWeek(
  username: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<WeekDay[]> {
  const [events, slots] = await Promise.all([
    getPublicEvents(username, weekStart, weekEnd).catch(() => []),
    listPublicSlotsByUsername(username),
  ]);

  // Materialize bookable options for slots, capped to this week.
  const slotItems: WeekItem[] = [];
  await Promise.all(
    slots.map(async (s) => {
      try {
        const opts = await getBookableOptions(s);
        for (const o of opts) {
          const t = new Date(o.start_at);
          if (t < weekStart || t >= weekEnd) continue;
          slotItems.push({
            kind: "slot",
            id: `${s.id}::${o.start_at}`,
            slot_id: s.id,
            slot_slug: s.slug,
            start_at: o.start_at,
            end_at: o.end_at,
            title: s.title,
            price_cents: s.price_cents,
            duration_min: s.duration_min,
          });
        }
      } catch {
        // ignore individual slot failures
      }
    }),
  );

  const eventItems: WeekItem[] = events.map((e) => ({
    kind: "event",
    id: e.id,
    start_at: e.start_at,
    end_at: e.end_at,
    all_day: e.all_day,
    title: e.title,
    color: e.calendar_color,
  }));

  const all = [...eventItems, ...slotItems].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  // Group into 7 days
  const todayKey = dayKey(new Date());
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = dayKey(d);
    days.push({
      date: d,
      isToday: key === todayKey,
      items: all.filter((it) => dayKey(new Date(it.start_at)) === key),
    });
  }

  return days;
}

export function startOfWeek(d: Date) {
  // Monday-start, in local time
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() + 6) % 7; // 0 = Mon
  out.setDate(out.getDate() - dow);
  return out;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
