import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { expireStaleReschedules } from "@/lib/booking-reschedule-expiry";

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
  if (!tokensOk) {
    return NextResponse.json(
      { error: "failed", rescheduleExpired: expired },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, rescheduleExpired: expired });
}
