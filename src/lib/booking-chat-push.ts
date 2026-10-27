import { getAdminClient } from "@/lib/supabase";
import { apnsConfigured, devicesOf, sendPush, type PushDevice } from "@/lib/apns";
import type { ChatBooking, ChatRole, ChatThreadRow } from "@/lib/booking-chat";

/**
 * 예약 대화 앱 푸시 (1.8.0 2단계, 설계 3·4절).
 * - 푸시 대상: 계정이 있고 + 기기 토큰이 있고 + 알림 설정 booking_message.push 가 켜져 있고 + 서버에 APNs 키가 있을 때.
 *   대상이면 바로 푸시, 아니면 지금처럼 메일 묶음(booking-chat-mail)이 알린다.
 * - 문구는 "새 메시지가 있어요"만(보낸 사람·내용 없음, CEO 10/27). collapse-id = booking_id.
 * - 같은 대화는 최소 60초 간격(booking_threads.*_pushed_at).
 */
export const CHAT_PUSH_BODY = "새 메시지가 있어요";
const PUSH_GAP_MS = 60_000;

/** 이 사람에게 푸시로 알릴 수 있으면 기기 목록, 아니면 null(메일로 알린다) */
export async function chatPushTarget(userId: string | null): Promise<PushDevice[] | null> {
  if (!userId || !apnsConfigured()) return null;
  const { pushAllowed } = await import("@/lib/notification-prefs");
  if (!(await pushAllowed(userId, "booking_message"))) return null;
  const devices = await devicesOf(userId);
  return devices.length > 0 ? devices : null;
}

/** 60초 간격 규칙 (순수 함수) */
export function pushGapOk(pushedAt: string | null, now: number): boolean {
  return !pushedAt || now - new Date(pushedAt).getTime() >= PUSH_GAP_MS;
}

export async function pushChatMessage(b: ChatBooking, recipient: ChatRole, now = Date.now()): Promise<"sent" | "skipped"> {
  const userId = recipient === "host" ? b.host_id : b.guest_id;
  if (!userId) return "skipped"; // 계정 없는 게스트는 메일
  if (!apnsConfigured()) {
    console.log("[push] skipped no-key");
    return "skipped";
  }
  const devices = await chatPushTarget(userId);
  if (!devices) return "skipped";
  const db = getAdminClient();
  const { data: t } = await db
    .from("booking_threads")
    .select("host_pushed_at, guest_pushed_at")
    .eq("booking_id", b.id)
    .maybeSingle();
  const row = t as Pick<ChatThreadRow, "host_pushed_at" | "guest_pushed_at"> | null;
  const pushedAt = recipient === "host" ? row?.host_pushed_at ?? null : row?.guest_pushed_at ?? null;
  if (!pushGapOk(pushedAt, now)) return "skipped";
  const delivered = await sendPush(devices, {
    body: CHAT_PUSH_BODY,
    collapseId: b.id,
    data: { kind: "booking_message", bookingId: b.id, role: recipient },
  });
  if (delivered === 0) return "skipped";
  const at = new Date(now).toISOString();
  await db
    .from("booking_threads")
    .update(recipient === "host" ? { host_pushed_at: at } : { guest_pushed_at: at })
    .eq("booking_id", b.id);
  return "sent";
}
