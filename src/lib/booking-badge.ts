import { getAdminClient } from "@/lib/supabase";

/**
 * 내가 답할 예약 건수 — 웹 사이드바·하단 탭 '예약' 옆 숫자 (개선-30).
 * 앱 예약 탭 배지(PendingBookingsCounter)와 같은 셈:
 *   받은 예약 중 승인 대기이거나 상대가 보낸 시간 변경 제안이 와 있는 것(한 예약은 한 번)
 *   + 내가 한 예약 중 상대가 보낸 시간 변경 제안이 와 있는 것
 *   + 답하지 않은 받은 시간 요청
 * 숨긴(삭제)·보관한 예약은 목록에 안 보이므로 세지 않는다. 내가 보낸 제안도 세지 않는다.
 */
export async function bookingsNeedingReplyCount(userId: string): Promise<number> {
  const db = getAdminClient();
  const [host, guest, requests] = await Promise.all([
    db
      .from("bookings")
      .select("id, status, reschedule_by")
      .eq("host_id", userId)
      .eq("hidden_by_host", false)
      .eq("archived_by_host", false)
      .or("status.eq.pending,reschedule_by.not.is.null"),
    db
      .from("bookings")
      .select("id, reschedule_by")
      .eq("guest_id", userId)
      .eq("hidden_by_guest", false)
      .eq("archived_by_guest", false)
      .not("reschedule_by", "is", null),
    db
      .from("time_requests")
      .select("id", { count: "exact", head: true })
      .eq("host_id", userId)
      .eq("status", "pending"),
  ]);
  const incoming = (by: unknown) => by != null && by !== userId;
  const hostCount = (host.data ?? []).filter(
    (b) => b.status === "pending" || incoming(b.reschedule_by),
  ).length;
  const guestCount = (guest.data ?? []).filter((b) => incoming(b.reschedule_by)).length;
  return hostCount + guestCount + (requests.count ?? 0);
}
