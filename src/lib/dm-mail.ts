import { getAdminClient } from "@/lib/supabase";
import { shouldEmail } from "@/lib/booking-chat-mail";
import { sideOf, type DmRow } from "@/lib/dm";
import { v190Open } from "@/lib/dm-flags";

/**
 * 1:1 대화 메일 묶음 (1.9.0) — 예약 대화 메일 cron(5분)이 함께 부른다. 규칙은 예약 대화와 같다(shouldEmail):
 * 안 읽은 글이 3분 넘게 지났고, 같은 대화 10분 간격, 하루 6통까지. 메일에는 보낸 사람·본문을 넣지 않는다.
 * 열린 대화만 — 대화 요청은 메일을 보내지 않는다(앱 안 알림만). 앱 푸시 대상이면 메일은 보내지 않는다.
 */
const LOOKBACK_MS = 3 * 24 * 60 * 60_000;

function kstDay(d: Date) {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function runDmMailDigest(now = Date.now(), opts: { onlyConversationId?: string } = {}) {
  if (!v190Open(new Date(now))) return 0;
  const db = getAdminClient();
  let q = db
    .from("conversations")
    .select("*")
    .eq("status", "open")
    .gte("last_message_at", new Date(now - LOOKBACK_MS).toISOString());
  if (opts.onlyConversationId) q = q.eq("id", opts.onlyConversationId);
  const { data } = await q.limit(500);
  let sent = 0;
  for (const c of (data ?? []) as DmRow[]) {
    for (const side of ["a", "b"] as const) {
      try {
        if (await emailOne(c, side, now)) sent++;
      } catch (err) {
        console.error("[dm-mail]", err);
      }
    }
  }
  return sent;
}

async function emailOne(c: DmRow, side: "a" | "b", now: number): Promise<boolean> {
  const db = getAdminClient();
  const me = side === "a" ? c.user_a : c.user_b;
  const other = side === "a" ? c.user_b : c.user_a;
  if (sideOf(c, me) !== side) return false;
  const readAt = side === "a" ? c.a_last_read_at : c.b_last_read_at;
  const leftAt = side === "a" ? c.a_left_at : c.b_left_at;
  const after = [readAt, leftAt].filter(Boolean).sort().pop() ?? "1970-01-01T00:00:00Z";
  const { data: rows } = await db
    .from("messages")
    .select("sender_id, body, created_at")
    .eq("conversation_id", c.id)
    .eq("sender_id", other)
    .gt("created_at", after)
    .order("created_at", { ascending: true })
    .limit(50);
  const unread = (rows ?? []).map((m) => ({ sender_role: "guest" as const, body: m.body as string, created_at: m.created_at as string }));
  const emailedAt = side === "a" ? c.a_emailed_at : c.b_emailed_at;
  const emailDay = side === "a" ? c.a_email_day : c.b_email_day;
  const emailCount = side === "a" ? c.a_email_count : c.b_email_count;
  // recipient 'host' + guestHasAccount → 예약 대화의 '계정 없는 게스트 첫 메일' 예외가 걸리지 않는다
  if (!shouldEmail({ recipient: "host", guestHasAccount: true, unread, emailedAt, emailDay, emailCount, now })) return false;

  const { isBlockedEitherWay } = await import("@/lib/blocks");
  if (await isBlockedEitherWay(me, other)) return false;
  const { data: user } = await db.from("users").select("email, email_verified").eq("id", me).maybeSingle();
  if (!user?.email || !user.email_verified) return false;
  const { emailAllowed } = await import("@/lib/notification-prefs");
  if (!(await emailAllowed(me, "direct_message"))) return false;
  const { dmPushTarget } = await import("@/lib/dm");
  if (await dmPushTarget(me)) return false;

  const { sendDmEmail, siteUrl } = await import("@/lib/email");
  const res = await sendDmEmail(user.email as string, { replyUrl: siteUrl(`/messages/${c.id}`) });
  if (!res.ok) return false;
  const today = kstDay(new Date(now));
  const count = emailDay === today ? emailCount + 1 : 1;
  await db
    .from("conversations")
    .update({ [`${side}_emailed_at`]: new Date(now).toISOString(), [`${side}_email_day`]: today, [`${side}_email_count`]: count })
    .eq("id", c.id);
  return true;
}
