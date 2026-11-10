import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runChatMailDigest } from "@/lib/booking-chat-mail";

/** 예약 대화 메일 묶음 — 5분마다(1.8.0). 규칙은 lib/booking-chat-mail.ts. CRON_SECRET 필요. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await runChatMailDigest();
  return NextResponse.json({ ok: true, sent });
}
