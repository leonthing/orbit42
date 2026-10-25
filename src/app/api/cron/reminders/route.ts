import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runBookingReminders } from "@/lib/booking-reminders";

/** 예약 리마인더(하루 전·1시간 전) — 10분마다. 내용은 lib/booking-reminders.ts. CRON_SECRET 필요. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await runBookingReminders();
  if (!sent) return NextResponse.json({ error: "db_error" }, { status: 500 });
  return NextResponse.json({ ok: true, sent });
}
