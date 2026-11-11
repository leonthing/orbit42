import { getAdminClient } from "@/lib/supabase";

/** 예약 상태 변경 기록(보안-8) — 어느 쪽이(호스트·게스트·관리 링크·시스템) 무엇을 바꿨는지. 처리방침 범위(상태·시각·주체 종류)만, 기록 실패는 본 동작을 막지 않는다. */
export type BookingActorKind = "host" | "guest" | "guest_link" | "system";

export async function logBookingEvent(e: {
  bookingId: string;
  actorKind: BookingActorKind;
  action: "status" | "reschedule";
  fromStatus?: string | null;
  toStatus?: string | null;
}): Promise<void> {
  const { error } = await getAdminClient().from("booking_events").insert({
    booking_id: e.bookingId,
    actor_kind: e.actorKind,
    action: e.action,
    from_status: e.fromStatus ?? null,
    to_status: e.toStatus ?? null,
  });
  // 42P01: 마이그레이션 전(표 없음) — 조용히 넘긴다
  if (error && error.code !== "42P01" && error.code !== "PGRST205") console.error("logBookingEvent", error.message);
}

const RETENTION_MS = 365 * 24 * 3600_000;

/** cleanup cron: 예약이 끝난 날로부터 1년 지난 기록을 지운다(예약 대화와 같은 기준) */
export async function cleanupBookingEvents(): Promise<number> {
  const db = getAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  const { data, error } = await db
    .from("booking_events")
    .select("id, booking:bookings!booking_events_booking_id_fkey(scheduled_at, scheduled_end_at)")
    .lt("created_at", cutoff)
    .limit(1000);
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("cleanupBookingEvents", error.message);
    return 0;
  }
  const ids = ((data ?? []) as unknown as Array<{ id: number; booking: { scheduled_at: string; scheduled_end_at: string | null } | null }>)
    .filter((r) => !r.booking || new Date(r.booking.scheduled_end_at ?? r.booking.scheduled_at).toISOString() < cutoff)
    .map((r) => r.id);
  if (ids.length === 0) return 0;
  const { count } = await db.from("booking_events").delete({ count: "exact" }).in("id", ids);
  return count ?? 0;
}
