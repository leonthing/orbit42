import { getAdminClient } from "@/lib/supabase";

/**
 * 내 예약 목록에서만 보관/되돌리기/삭제(숨김) — 상대방 목록과 거래 기록은 그대로 (개선-25·28).
 * 앱 API(PATCH archive/unarchive, DELETE)와 웹 예약 화면이 같은 규칙을 쓰도록 한곳에 둔다.
 * 진행 중(대기/확정 + 미래) 예약은 보관·삭제할 수 없다. 되돌리기는 언제나 된다.
 */
export type BookingListChange = "archive" | "unarchive" | "delete";

export type BookingListResult =
  | { ok: true }
  | { error: string; status: number };

const ACTIVE_ERRORS: Record<"archive" | "delete", string> = {
  archive: "진행 중인 예약은 보관할 수 없어요. 끝난 예약만 보관할 수 있어요.",
  delete: "진행 중인 예약은 먼저 취소한 뒤에 삭제할 수 있어요.",
};

const FAIL_ERRORS: Record<BookingListChange, string> = {
  archive: "보관하지 못했어요.",
  unarchive: "되돌리지 못했어요.",
  delete: "삭제에 실패했어요.",
};

export async function changeBookingListState(
  userId: string,
  bookingId: string,
  change: BookingListChange,
): Promise<BookingListResult> {
  const db = getAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("id, host_id, guest_id, status, scheduled_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "예약을 찾을 수 없어요.", status: 404 };

  const isHost = booking.host_id === userId;
  const isGuest = booking.guest_id === userId;
  if (!isHost && !isGuest) return { error: "권한이 없어요.", status: 403 };

  const active =
    ["pending", "confirmed"].includes(booking.status as string) &&
    new Date(booking.scheduled_at as string).getTime() > Date.now();
  if (active && change !== "unarchive") {
    return { error: ACTIVE_ERRORS[change], status: 400 };
  }

  const patch =
    change === "delete"
      ? isHost
        ? { hidden_by_host: true }
        : { hidden_by_guest: true }
      : isHost
        ? { archived_by_host: change === "archive" }
        : { archived_by_guest: change === "archive" };
  const { error } = await db.from("bookings").update(patch).eq("id", bookingId);
  if (error) {
    console.error(`booking ${change}`, error);
    return { error: FAIL_ERRORS[change], status: 400 };
  }
  return { ok: true };
}
