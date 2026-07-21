import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendWeeklyDigestEmail } from "@/lib/email";
import { emailAllowed } from "@/lib/notification-prefs";

/**
 * Weekly digest: summarizes the last 7 days of notifications plus
 * unread DMs and upcoming bookings per user. Sent Monday morning KST
 * (scheduled in vercel.json); users with nothing to report are
 * skipped. Gated by CRON_SECRET.
 */
import { isAuthorizedCron } from "@/lib/cron-auth";

const TYPE_LABELS: Record<string, (n: number) => string> = {
  new_follower: (n) => `새 팔로워 ${n}명이 생겼어요.`,
  reaction: (n) => `내 글과 일정에 반응 ${n}개를 받았어요.`,
  comment_received: (n) => `댓글 ${n}개를 받았어요.`,
  reply_received: (n) => `답글 ${n}개를 받았어요.`,
  booking_received: (n) => `새 예약/요청 ${n}건이 들어왔어요.`,
  booking_confirmed: (n) => `예약 ${n}건이 확정됐어요.`,
  invite_used: (n) => `내 추천으로 ${n}명이 가입했어요.`,
};

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const bookingHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  const { data: users, error } = await db
    .from("users")
    .select("id, username, display_name, email, email_verified")
    .eq("email_verified", true)
    .not("email", "is", null);
  if (error) {
    console.error("digest cron users", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const u of users ?? []) {
    try {
      if (!(await emailAllowed(u.id as string, "weekly_digest"))) {
        skipped++;
        continue;
      }

      const [notifRes, convRes, bookingRes] = await Promise.all([
        db
          .from("notifications")
          .select("type")
          .eq("user_id", u.id)
          .gte("created_at", since.toISOString()),
        db
          .from("conversations")
          .select(
            "user_a, user_b, a_last_read_at, b_last_read_at, last_message_at, last_sender_id",
          )
          .or(`user_a.eq.${u.id},user_b.eq.${u.id}`),
        db
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "confirmed")
          .or(`host_id.eq.${u.id},guest_id.eq.${u.id}`)
          .gt("scheduled_at", now.toISOString())
          .lte("scheduled_at", bookingHorizon.toISOString()),
      ]);

      const counts = new Map<string, number>();
      for (const n of notifRes.data ?? []) {
        const t = n.type as string;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const lines: string[] = [];
      for (const [type, label] of Object.entries(TYPE_LABELS)) {
        const n = counts.get(type) ?? 0;
        if (n > 0) lines.push(label(n));
      }

      let unreadMessages = 0;
      for (const c of convRes.data ?? []) {
        const isA = c.user_a === u.id;
        const myLastRead = (isA ? c.a_last_read_at : c.b_last_read_at) as
          | string
          | null;
        const lastAt = c.last_message_at as string | null;
        if (!lastAt || c.last_sender_id === u.id) continue;
        if (!myLastRead || new Date(myLastRead) < new Date(lastAt)) {
          unreadMessages++;
        }
      }

      const upcomingBookings = bookingRes.count ?? 0;

      if (lines.length === 0 && unreadMessages === 0 && upcomingBookings === 0) {
        skipped++;
        continue;
      }

      await sendWeeklyDigestEmail(u.email as string, {
        name: (u.display_name || u.username) as string,
        username: u.username as string,
        lines,
        unreadMessages,
        upcomingBookings,
      });
      sent++;
    } catch (err) {
      console.error("digest cron user", u.username, err);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
