import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// Manual/scheduled cleanup endpoint. Gate with CRON_SECRET so random
// traffic can't trigger deletes.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when the
  // env var is set; manual pings can pass ?key=<CRON_SECRET>.
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("key") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = getAdminClient();
  try {
    await db.rpc("cleanup_auth_tokens");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("cleanup_auth_tokens", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
