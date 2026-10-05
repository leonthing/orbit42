import { getAdminClient } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { removeBookingCalendarEvent } from "@/lib/booking-calendar";

/**
 * 입금 기한이 지난 계좌이체 예약을 취소한다.
 *
 * 유료 슬롯 예약은 호스트가 입금을 확인할 때까지 '입금 대기'(pending + awaiting)로
 * 그 시간을 잡아 둔다. 기한(payment_due_at)이 지나도 확인되지 않으면 시간을 다시
 * 열어야 다른 사람이 예약할 수 있다. 매시 cleanup cron 에서 호출한다.
 */
export async function expireUnpaidBookings(): Promise<{ expired: number }> {
  const db = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await db
    .from("bookings")
    .select(
      "id, host_id, guest_id, guest_email, availability_id, scheduled_at, slot:time_slots!bookings_slot_id_fkey(title), host:users!bookings_host_id_fkey(username, display_name)",
    )
    .eq("status", "pending")
    .eq("payment_status", "awaiting")
    .lte("payment_due_at", nowIso)
    .limit(200);
  if (error) {
    console.error("expireUnpaidBookings select", error);
    return { expired: 0 };
  }

  let expired = 0;
  for (const b of (rows ?? []) as unknown as Array<{
    id: string;
    host_id: string;
    guest_id: string | null;
    guest_email: string | null;
    availability_id: string | null;
    scheduled_at: string;
    slot: { title: string } | null;
    host: { username: string; display_name: string | null } | null;
  }>) {
    // 그 사이 호스트가 확정했으면 건드리지 않는다.
    const { data: updated } = await db
      .from("bookings")
      .update({ status: "canceled", updated_at: nowIso })
      .eq("id", b.id)
      .eq("status", "pending")
      .eq("payment_status", "awaiting")
      .select("id");
    if (!updated?.length) continue;
    expired += 1;

    await removeBookingCalendarEvent(b.id);
    await db.from("events").delete().eq("booking_id", b.id);
    if (b.availability_id) {
      await db.from("slot_availabilities").update({ booked_count: 0 }).eq("id", b.availability_id);
    }

    const title = b.slot?.title ?? "예약";
    try {
      await createNotification({
        userId: b.host_id,
        type: "booking_canceled",
        title: `입금 기한이 지나 취소됐어요: ${title}`,
        body: "시간이 다시 열렸어요.",
        link: `/${b.host?.username ?? ""}/bookings`,
      });
    } catch (err) {
      console.error("expireUnpaidBookings host notify", err);
    }
    if (b.guest_id) {
      try {
        await createNotification({
          userId: b.guest_id,
          type: "booking_canceled",
          title: `입금 기한이 지나 예약이 취소됐어요: ${title}`,
          body: "다시 예약하려면 호스트 페이지에서 시간을 골라주세요.",
          link: `/bookings`,
        });
      } catch (err) {
        console.error("expireUnpaidBookings guest notify", err);
      }
    }
    const to = b.guest_email;
    if (to) {
      try {
        const { sendBookingCanceledToGuest } = await import("@/lib/email");
        await sendBookingCanceledToGuest(to, {
          slotTitle: title,
          when: b.scheduled_at,
          hostLabel: b.host?.display_name || b.host?.username || "Host",
        });
      } catch (err) {
        console.error("expireUnpaidBookings guest email", err);
      }
    }
  }
  return { expired };
}
