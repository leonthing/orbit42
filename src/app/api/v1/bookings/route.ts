import { apiSession } from "@/lib/api-auth";
import {
  listMyHostBookings,
  listMyGuestBookings,
  type BookingRow,
  type GuestBookingRow,
} from "@/lib/slots";

export const dynamic = "force-dynamic";

/**
 * 대기 중인 시간 변경 제안. `byMe` 로 "상대 응답 대기 중"과
 * "내가 수락/거절해야 함"을 클라이언트가 구분한다.
 */
function toApiReschedule(
  b: Pick<
    BookingRow,
    | "reschedule_by"
    | "reschedule_start_at"
    | "reschedule_end_at"
    | "reschedule_note"
    | "reschedule_by_me"
  >,
) {
  if (!b.reschedule_by || !b.reschedule_start_at || !b.reschedule_end_at) {
    return null;
  }
  return {
    startAt: b.reschedule_start_at,
    endAt: b.reschedule_end_at,
    note: b.reschedule_note,
    byMe: b.reschedule_by_me ?? false,
  };
}

function toApiHostBooking(b: BookingRow) {
  return {
    id: b.id,
    scheduledAt: b.scheduled_at,
    scheduledEndAt: b.scheduled_end_at,
    status: b.status,
    message: b.message,
    guestName:
      b.guest?.display_name || b.guest?.username || b.guest_name || "게스트",
    guestUsername: b.guest?.username ?? null,
    // 회원이 아닌 게스트에게 연락할 수 있도록 (호스트에게만 내려준다)
    guestEmail: b.guest_email ?? null,
    priceCents: b.slot.price_cents ?? 0,
    payment: b.payment_status
      ? { status: b.payment_status, dueAt: b.payment_due_at }
      : null,
    slotTitle: b.slot.title,
    slotSlug: b.slot.slug,
    locationDetail: b.slot.location_detail ?? null,
    menus: (b.selected_menus ?? []).map((m) => ({
      name: m.name,
      priceCents: m.price_cents,
    })),
    reschedule: toApiReschedule(b),
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
    priceCents: b.slot.price_cents ?? 0,
    // 입금 대기 중일 때만 호스트의 입금 안내를 함께 내려준다
    payment: b.payment_status
      ? {
          status: b.payment_status,
          dueAt: b.payment_due_at,
          instructions: b.payment_status === "awaiting" ? b.host?.payment_instructions ?? null : null,
        }
      : null,
    slotTitle: b.slot.title,
    slotSlug: b.slot.slug,
    locationDetail: b.slot.location_detail,
    menus: (b.selected_menus ?? []).map((m) => ({
      name: m.name,
      priceCents: m.price_cents,
    })),
    reschedule: toApiReschedule(b),
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
