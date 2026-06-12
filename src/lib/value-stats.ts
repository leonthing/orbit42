import { getAdminClient } from "@/lib/supabase";

export type ValueStats = {
  total_bookings: number;
  total_revenue_cents: number;
  average_price_cents: number;
  highest_bid_cents: number | null;
  /** Hours actually traded through bookings (confirmed/completed). */
  total_booked_hours: number;
  /** Implied price of one hour of this host's time, in cents. */
  hourly_rate_cents: number | null;
};

/**
 * Aggregate signals of how valuable a host's time has become:
 *   - total confirmed/completed bookings
 *   - cumulative revenue (sum of price × counted bookings + winning auction bids)
 *   - average price across realised transactions
 *   - highest single auction bid the host has ever attracted
 */
export async function getValueStats(username: string): Promise<ValueStats> {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (!user) {
    return {
      total_bookings: 0,
      total_revenue_cents: 0,
      average_price_cents: 0,
      highest_bid_cents: null,
      total_booked_hours: 0,
      hourly_rate_cents: null,
    };
  }

  const hostId = user.id as string;

  const [bookingsRes, slotsRes] = await Promise.all([
    db
      .from("bookings")
      .select("id, slot_id, status, scheduled_at, scheduled_end_at")
      .eq("host_id", hostId)
      .in("status", ["confirmed", "completed"]),
    db
      .from("time_slots")
      .select("id, price_cents, pricing_model, current_high_bid_cents")
      .eq("host_id", hostId),
  ]);

  const slotById = new Map<
    string,
    { price_cents: number; pricing_model: string; current_high_bid_cents: number | null }
  >();
  for (const s of slotsRes.data ?? []) {
    slotById.set(s.id as string, {
      price_cents: (s.price_cents as number) ?? 0,
      pricing_model: (s.pricing_model as string) ?? "fixed",
      current_high_bid_cents: (s.current_high_bid_cents as number | null) ?? null,
    });
  }

  let bookingRevenue = 0;
  let bookedMs = 0;
  const totalBookings = (bookingsRes.data ?? []).length;
  for (const b of bookingsRes.data ?? []) {
    const meta = slotById.get(b.slot_id as string);
    if (meta && meta.pricing_model === "fixed") bookingRevenue += meta.price_cents;
    const s = new Date(b.scheduled_at as string).getTime();
    const e = new Date(b.scheduled_end_at as string).getTime();
    if (e > s) bookedMs += e - s;
  }
  const bookedHours = bookedMs / 3_600_000;

  // Auction revenue: sum of winning bids on slots that have a high bid.
  let auctionRevenue = 0;
  let highestBid: number | null = null;
  for (const meta of Array.from(slotById.values())) {
    if (meta.pricing_model === "auction" && meta.current_high_bid_cents) {
      auctionRevenue += meta.current_high_bid_cents;
      if (!highestBid || meta.current_high_bid_cents > highestBid) {
        highestBid = meta.current_high_bid_cents;
      }
    }
  }

  const totalRevenue = bookingRevenue + auctionRevenue;

  // Average across realised slots (bookings + auction wins)
  const realisedCount = totalBookings + (auctionRevenue > 0 ? 1 : 0);
  const avg = realisedCount > 0 ? Math.round(totalRevenue / realisedCount) : 0;

  return {
    total_bookings: totalBookings,
    total_revenue_cents: totalRevenue,
    average_price_cents: avg,
    highest_bid_cents: highestBid,
    total_booked_hours: Math.round(bookedHours * 10) / 10,
    hourly_rate_cents:
      totalRevenue > 0 && bookedHours > 0
        ? Math.round(totalRevenue / bookedHours)
        : null,
  };
}
