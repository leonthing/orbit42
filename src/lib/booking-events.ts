import { getAdminClient } from "@/lib/supabase";

/** 예약 상태 변경 기록(보안-8) — 누가(호스트·게스트·관리 링크·시스템) 무엇을 바꿨는지. 기록 실패는 본 동작을 막지 않는다. */
export type BookingActorKind = "host" | "guest" | "guest_link" | "system";

export async function logBookingEvent(e: {
  bookingId: string;
  actorKind: BookingActorKind;
  actorId?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
}): Promise<void> {
  const { error } = await getAdminClient().from("booking_events").insert({
    booking_id: e.bookingId,
    actor_kind: e.actorKind,
    actor_id: e.actorId ?? null,
    action: e.action,
    from_status: e.fromStatus ?? null,
    to_status: e.toStatus ?? null,
  });
  // 42P01: 마이그레이션 전(표 없음) — 조용히 넘긴다
  if (error && error.code !== "42P01" && error.code !== "PGRST205") console.error("logBookingEvent", error.message);
}
