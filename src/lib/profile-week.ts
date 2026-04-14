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
      start_at: string; // window start
      end_at: string; // window end (covers all merged options)
      title: string;
      price_cents: number;
      duration_min: number; // of a single booking
      /** Number of distinct bookable options inside this visual window. */
      option_count: number;
      pricing_model: "fixed" | "auction";
      reserve_price_cents: number | null;
      auction_ends_at: string | null;
      current_high_bid_cents: number | null;
      bid_count: number;
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
  calendarIds?: string[],
): Promise<WeekDay[]> {
  const [events, slots] = await Promise.all([
    getPublicEvents(username, weekStart, weekEnd, calendarIds).catch(() => []),
    listPublicSlotsByUsername(username),
  ]);

  // Fetch bid counts for any auction slots in one go.
  const auctionIds = slots
    .filter((s) => s.pricing_model === "auction")
    .map((s) => s.id);
  const bidCountMap = new Map<string, number>();
  if (auctionIds.length > 0) {
    const { getAdminClient } = await import("@/lib/supabase");
    const db = getAdminClient();
    const { data: bidRows } = await db
      .from("bids")
      .select("slot_id")
      .in("slot_id", auctionIds);
    for (const row of (bidRows ?? []) as { slot_id: string }[]) {
      bidCountMap.set(row.slot_id, (bidCountMap.get(row.slot_id) ?? 0) + 1);
    }
  }

  // Materialize bookable options per slot, then merge consecutive options
  // into visual windows so the calendar stays readable when Auto-mode slots
  // generate many back-to-back 30-min options.
  const slotItems: WeekItem[] = [];
  await Promise.all(
    slots.map(async (s) => {
      try {
        const optsRaw = await getBookableOptions(s);
        const opts = optsRaw
          .filter((o) => {
            const t = new Date(o.start_at);
            return t >= weekStart && t < weekEnd;
          })
          .sort(
            (a, b) =>
              new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
          );

        let i = 0;
        while (i < opts.length) {
          const windowStart = opts[i].start_at;
          let windowEnd = opts[i].end_at;
          let count = 1;
          const startDay = dayKey(new Date(windowStart));
          i++;
          while (i < opts.length) {
            const prevEnd = new Date(windowEnd).getTime();
            const nextStart = new Date(opts[i].start_at).getTime();
            const sameDay = dayKey(new Date(opts[i].start_at)) === startDay;
            // Merge if back-to-back and still on the same day.
            if (sameDay && nextStart === prevEnd) {
              windowEnd = opts[i].end_at;
              count++;
              i++;
            } else {
              break;
            }
          }
          slotItems.push({
            kind: "slot",
            id: `${s.id}::${windowStart}`,
            slot_id: s.id,
            slot_slug: s.slug,
            start_at: windowStart,
            end_at: windowEnd,
            title: s.title,
            price_cents: s.price_cents,
            duration_min: s.duration_min,
            option_count: count,
            pricing_model: s.pricing_model,
            reserve_price_cents: s.reserve_price_cents,
            auction_ends_at: s.auction_ends_at,
            current_high_bid_cents: s.current_high_bid_cents,
            bid_count: bidCountMap.get(s.id) ?? 0,
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
