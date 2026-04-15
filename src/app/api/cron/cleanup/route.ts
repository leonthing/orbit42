import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// Manual/scheduled cleanup endpoint. Gate with CRON_SECRET so random
// traffic can't trigger deletes.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
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
