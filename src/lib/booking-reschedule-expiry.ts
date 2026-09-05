import { getAdminClient } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

/**
 * 응답 없이 시효가 지난 시간 변경 제안을 걷어낸다.
 *
 * 제안은 예약 행에 얹혀 있어 아무도 응답하지 않으면 영원히 남는다.
 * 수락 시점에 과거면 거부되긴 하지만, 그때까지 "대기 중" 배너가 계속 떠 있고
 * 앱은 이미 지난 시각을 제안으로 보여 준다. 다음 둘 중 하나면 제안은 무의미하다:
 *   - 제안한 시각이 이미 지났다
 *   - 원래 예약 시각이 이미 지났다 (옮길 대상 자체가 끝났다)
 * 그 밖에 예약이 취소·완료된 경우도 제안만 남아 있을 수 있어 함께 정리한다.
 *
 * 매시 cleanup cron 에서 호출한다. 제안자에게만 만료를 알린다 — 응답하지 않은
 * 쪽에 "응답 안 해서 만료됐다"고 알리는 건 잔소리에 가깝다.
 */
export async function expireStaleReschedules(): Promise<{
  expired: number;
}> {
  const db = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await db
    .from("bookings")
    .select(
      "id, host_id, guest_id, slot_id, status, scheduled_at, reschedule_by, reschedule_start_at, reschedule_created_at",
    )
    .not("reschedule_created_at", "is", null)
    .or(
      `reschedule_start_at.lte.${nowIso},scheduled_at.lte.${nowIso},status.in.(canceled,completed)`,
    )
    .limit(200);
  if (error) {
    console.error("expireStaleReschedules select", error);
    return { expired: 0 };
  }

  let expired = 0;
  for (const b of rows ?? []) {
    // 그 사이 응답이 있었으면 건드리지 않도록 created_at 을 조건에 넣는다.
    const { error: clearErr } = await db
      .from("bookings")
      .update({
        reschedule_by: null,
        reschedule_start_at: null,
        reschedule_end_at: null,
        reschedule_note: null,
        reschedule_created_at: null,
        updated_at: nowIso,
      })
      .eq("id", b.id)
      .eq("reschedule_created_at", b.reschedule_created_at as string);
    if (clearErr) {
      console.error("expireStaleReschedules clear", b.id, clearErr);
      continue;
    }
    expired += 1;

    const proposerId = b.reschedule_by as string | null;
    if (!proposerId) continue;
    const bookingStillLive =
      b.status !== "canceled" && b.status !== "completed";
    try {
      const { data: slot } = await db
        .from("time_slots")
        .select("title")
        .eq("id", b.slot_id)
        .single();
      await createNotification({
        userId: proposerId,
        type: "booking_reschedule_expired",
        title: `'${slot?.title ?? "예약"}' 시간 변경 제안이 만료됐어요`,
        body: bookingStillLive
          ? "응답이 없어 제안이 지워졌어요. 예약은 원래 시간 그대로예요"
          : "예약이 끝나거나 취소되어 제안이 지워졌어요",
        link: `/bookings`,
      });
    } catch (err) {
      console.error("expireStaleReschedules notify", b.id, err);
    }
  }
  return { expired };
}
