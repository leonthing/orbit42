import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import {
  sendBookingConfirmedToGuest,
  sendBookingReceivedToHost,
} from "@/lib/email";
import { emailAllowed } from "@/lib/notification-prefs";

/**
 * Finalize auctions whose `auction_ends_at` has passed. Converts the
 * highest bid into a confirmed booking, flips the slot to inactive,
 * and emails both sides. Gated by CRON_SECRET.
 */
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const nowIso = new Date().toISOString();
  const { data: expired, error } = await db
    .from("time_slots")
    .select(
      "id, host_id, title, duration_min, location_detail, auction_ends_at, reserve_price_cents, current_high_bid_cents, current_high_bidder_id, calendar_id",
    )
    .eq("pricing_model", "auction")
    .eq("active", true)
    .lt("auction_ends_at", nowIso);
  if (error) {
    console.error("auctions cron select", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  let finalized = 0;
  let closedNoBid = 0;

  for (const slot of expired ?? []) {
    const highBidder = slot.current_high_bidder_id as string | null;
    const high = (slot.current_high_bid_cents as number | null) ?? 0;
    const reserve = (slot.reserve_price_cents as number | null) ?? 0;
    const meetsReserve = high >= reserve && !!highBidder;

    await db.from("time_slots").update({ active: false }).eq("id", slot.id);

    if (!meetsReserve) {
      closedNoBid++;
      continue;
    }

    const { data: avail } = await db
      .from("slot_availabilities")
      .select("id, start_at, capacity")
      .eq("slot_id", slot.id)
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const startIso =
      (avail?.start_at as string | undefined) ??
      new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    const startAt = new Date(startIso);
    const endAt = new Date(
      startAt.getTime() + (slot.duration_min as number) * 60_000,
    );

    const { data: booking, error: bookErr } = await db
      .from("bookings")
      .insert({
        slot_id: slot.id,
        availability_id: avail?.id ?? null,
        host_id: slot.host_id,
        guest_id: highBidder,
        scheduled_at: startAt.toISOString(),
        scheduled_end_at: endAt.toISOString(),
        status: "confirmed",
        message: null,
      })
      .select("id")
      .single();
    if (bookErr || !booking) {
      console.error("auctions cron booking insert", bookErr);
      continue;
    }

    if (avail?.id) {
      await db
        .from("slot_availabilities")
        .update({ booked_count: (avail.capacity as number) ?? 1 })
        .eq("id", avail.id);
    }

    try {
      const [{ data: host }, { data: guest }] = await Promise.all([
        db
          .from("users")
          .select("email, display_name, username")
          .eq("id", slot.host_id)
          .single(),
        db
          .from("users")
          .select("email, display_name, username")
          .eq("id", highBidder)
          .single(),
      ]);
      if (
        host?.email &&
        (await emailAllowed(slot.host_id as string, "booking_received"))
      ) {
        await sendBookingReceivedToHost(host.email as string, {
          slotTitle: slot.title as string,
          when: startAt.toISOString(),
          guestLabel: (guest?.display_name ||
            guest?.username ||
            "낙찰자") as string,
          guestEmail: (guest?.email as string | null) ?? null,
          message: `경매 낙찰가: ₩${(high / 100).toLocaleString("ko-KR")}`,
          autoApprove: true,
          manageUrl: `/${host.username}/bookings`,
        });
      }
      if (
        guest?.email &&
        (await emailAllowed(highBidder, "booking_confirmed"))
      ) {
        await sendBookingConfirmedToGuest(guest.email as string, {
          slotTitle: slot.title as string,
          when: startAt.toISOString(),
          hostLabel: (host?.display_name ||
            host?.username ||
            "Host") as string,
          location: (slot.location_detail as string | null) ?? null,
        });
      }
    } catch (err) {
      console.error("auctions cron email", err);
    }

    finalized++;
  }

  return NextResponse.json({ ok: true, finalized, closedNoBid });
}
