import { getAdminClient } from "@/lib/supabase";
import { type ChatBooking, type ChatRole, type ChatThreadRow } from "@/lib/booking-chat";

/**
 * 예약 대화 메일 묶음 (1.8.0) — 5분마다 cron.
 * 받는 사람마다(호스트·게스트) 안 읽은 메시지가 있으면 1통으로 묶어 보낸다:
 * - 안 읽은 메시지 중 가장 오래된 것이 3분 넘게 지났을 것(그 사이 읽으면 안 감).
 *   단, 계정 없는 게스트에게 가는 호스트의 첫 메일은 기다리지 않는다(장소 안내가 첫 글인 경우가 많아서, PO 10/27).
 * - 같은 대화의 마지막 메일에서 10분이 지났을 것, 마지막 메일 뒤에 새 메시지가 있을 것.
 * - 같은 대화에 하루(한국 날짜) 6통까지.
 * - 메일에는 보낸 사람·본문 없이 "새 메시지가 있어요"와 열기 버튼만(CEO 10/27).
 * - 계정이 있는 사람은 알림 설정(booking_message 메일)을 따른다. 앱 푸시 대상(키·기기·푸시 켜짐)이면 메일은 보내지 않는다.
 */
const WAIT_MS = 3 * 60_000;
const GAP_MS = 10 * 60_000;
const DAILY_CAP = 6;
const LOOKBACK_MS = 3 * 24 * 60 * 60_000;

function kstDay(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

type Msg = { sender_role: ChatRole; body: string; created_at: string };

/** 이 받는 사람에게 지금 메일을 보낼지 (순수 함수 — 테스트용으로 따로 둔다) */
export function shouldEmail(args: {
  recipient: ChatRole;
  guestHasAccount: boolean;
  unread: Msg[];
  emailedAt: string | null;
  emailDay: string | null;
  emailCount: number;
  now: number;
}): boolean {
  const { unread, now } = args;
  if (unread.length === 0) return false;
  const newest = unread[unread.length - 1].created_at;
  if (args.emailedAt && newest <= args.emailedAt) return false; // 이미 알린 메시지뿐
  if (args.emailedAt && now - new Date(args.emailedAt).getTime() < GAP_MS) return false;
  if (args.emailDay === kstDay(new Date(now)) && args.emailCount >= DAILY_CAP) return false;
  const firstHostMailToLinkGuest =
    args.recipient === "guest" && !args.guestHasAccount && !args.emailedAt && unread.some((m) => m.sender_role === "host");
  if (!firstHostMailToLinkGuest && now - new Date(unread[0].created_at).getTime() < WAIT_MS) return false;
  return true;
}

export async function runChatMailDigest(now = Date.now(), opts: { onlyBookingId?: string } = {}) {
  const db = getAdminClient();
  const since = new Date(now - LOOKBACK_MS).toISOString();
  let q = db.from("booking_threads").select("*").gte("last_message_at", since);
  // 시험용: 데모 예약 하나만 본다(다른 대화의 메일 기록을 건드리지 않게)
  if (opts.onlyBookingId) q = q.eq("booking_id", opts.onlyBookingId);
  const { data: threads } = await q.limit(500);
  let sent = 0;
  for (const t of (threads ?? []) as ChatThreadRow[]) {
    const { loadChatBooking } = await import("@/lib/booking-chat");
    const b = await loadChatBooking(t.booking_id);
    if (!b) continue;
    for (const recipient of ["host", "guest"] as const) {
      try {
        if (await emailOne(b, t, recipient, now)) sent++;
      } catch (err) {
        console.error("[chat-mail]", err);
      }
    }
  }
  return sent;
}

async function emailOne(b: ChatBooking, t: ChatThreadRow, recipient: ChatRole, now: number): Promise<boolean> {
  const db = getAdminClient();
  const readAt = recipient === "host" ? t.host_last_read_at : t.guest_last_read_at;
  const { data: rows } = await db
    .from("booking_messages")
    .select("sender_role, body, created_at")
    .eq("booking_id", b.id)
    .neq("sender_role", recipient)
    .gt("created_at", readAt ?? "1970-01-01T00:00:00Z")
    .order("created_at", { ascending: true })
    .limit(50);
  const unread = (rows ?? []) as Msg[];
  const emailedAt = recipient === "host" ? t.host_emailed_at : t.guest_emailed_at;
  const emailDay = recipient === "host" ? t.host_email_day : t.guest_email_day;
  const emailCount = recipient === "host" ? t.host_email_count : t.guest_email_count;
  if (!shouldEmail({ recipient, guestHasAccount: !!b.guest_id, unread, emailedAt, emailDay, emailCount, now })) return false;

  // 받는 주소와 설정
  const userId = recipient === "host" ? b.host_id : b.guest_id;
  let to: string | null = null;
  if (recipient === "host") to = b.host?.email ?? null;
  else to = b.guest?.email ?? b.guest_email ?? null;
  if (!to) return false;
  if (userId) {
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (!(await emailAllowed(userId, "booking_message"))) return false;
    // 앱 푸시로 알리는 사람(키 있음·기기 있음·푸시 켜짐)은 메일을 보내지 않는다. 키가 없으면 지금처럼 메일.
    const { chatPushTarget } = await import("@/lib/booking-chat-push");
    if (await chatPushTarget(userId)) return false;
  }

  // 답장 링크: 계정 없는 게스트는 관리 링크, 계정이 있으면 예약 화면의 대화
  let replyPath: string;
  if (recipient === "guest" && !b.guest_id) {
    const { ensureManagePath } = await import("@/lib/guest-manage");
    replyPath = await ensureManagePath(b.id);
  } else if (recipient === "host") {
    replyPath = `/${b.host?.username}/bookings?chat=${b.id}`;
  } else {
    replyPath = `/${b.guest?.username}/bookings?tab=guest&chat=${b.id}`;
  }

  // 메일에는 보낸 사람·본문을 넣지 않는다(CEO 10/27) — 예약 이름·일시와 열기 버튼만
  const { sendBookingChatEmail, siteUrl } = await import("@/lib/email");
  const res = await sendBookingChatEmail(to, {
    slotTitle: b.slot?.title ?? "예약",
    when: b.scheduled_at,
    replyUrl: siteUrl(replyPath),
    guestNote: recipient === "guest" && !b.guest_id,
  });
  if (!res.ok) return false;

  const today = kstDay(new Date(now));
  const count = emailDay === today ? emailCount + 1 : 1;
  const nowIso = new Date(now).toISOString();
  await db
    .from("booking_threads")
    .update(
      recipient === "host"
        ? { host_emailed_at: nowIso, host_email_day: today, host_email_count: count }
        : { guest_emailed_at: nowIso, guest_email_day: today, guest_email_count: count },
    )
    .eq("booking_id", b.id);
  return true;
}
