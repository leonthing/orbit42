import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { expireStaleReschedules } from "@/lib/booking-reschedule-expiry";
import { expireUnpaidBookings } from "@/lib/booking-payment-expiry";
import { cleanupChats } from "@/lib/booking-chat";

import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = getAdminClient();
  let tokensOk = true;
  try {
    await db.rpc("cleanup_auth_tokens");
  } catch (err) {
    tokensOk = false;
    console.error("cleanup_auth_tokens", err);
  }
  // 시효 지난 예약 시간 변경 제안 정리 — 토큰 정리와 독립적으로 돈다.
  const { expired } = await expireStaleReschedules();
  // 입금 기한이 지난 계좌이체 예약 취소 — 시간을 다시 연다.
  const { expired: unpaidExpired } = await expireUnpaidBookings();
  // 예약 대화: 예약 끝 + 1년 지난 대화, 처리하고 1년 지난 신고 기록 삭제 (1.8.0)
  let chats: { threads: number; reports: number } | null = null;
  try {
    chats = await cleanupChats();
  } catch (err) {
    console.error("cleanupChats", err);
  }
  if (!tokensOk) {
    return NextResponse.json(
      { error: "failed", rescheduleExpired: expired, unpaidExpired },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, rescheduleExpired: expired, unpaidExpired, chats });
}
