import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
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
