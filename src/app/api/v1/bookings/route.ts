import { apiSession } from "@/lib/api-auth";
import {
  listMyHostBookings,
  listMyGuestBookings,
  type BookingRow,
  type GuestBookingRow,
} from "@/lib/slots";

export const dynamic = "force-dynamic";

function toApiHostBooking(b: BookingRow) {
  return {
    id: b.id,
    scheduledAt: b.scheduled_at,
    scheduledEndAt: b.scheduled_end_at,
    status: b.status,
    message: b.message,
    guestName:
      b.guest?.display_name || b.guest?.username || b.guest_name || "게스트",
    slotTitle: b.slot.title,
    slotSlug: b.slot.slug,
    menus: (b.selected_menus ?? []).map((m) => ({
      name: m.name,
      priceCents: m.price_cents,
    })),
  };
}

function toApiGuestBooking(b: GuestBookingRow) {
  return {
    id: b.id,
    scheduledAt: b.scheduled_at,
    scheduledEndAt: b.scheduled_end_at,
    status: b.status,
    message: b.message,
    hostName: b.host?.display_name || b.host?.username || "호스트",
    hostUsername: b.host?.username ?? null,
    slotTitle: b.slot.title,
    locationDetail: b.slot.location_detail,
  };
}

// GET — 받은 예약(host) + 내가 한 예약(guest)을 한 번에.
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const [host, guest] = await Promise.all([
    listMyHostBookings(),
    listMyGuestBookings(),
  ]);
  return Response.json({
    host: host.map(toApiHostBooking),
    guest: guest.map(toApiGuestBooking),
  });
}
