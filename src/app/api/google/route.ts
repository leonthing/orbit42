import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUrl } from "@/lib/google";
import { getSession } from "@/lib/auth";

// GET /api/google?return=...&add=1 → redirect to Google OAuth
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = session;
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return") || "";
  const add = url.searchParams.get("add");

  const state = [username, returnTo, add ? "add" : ""].join(":");
  return NextResponse.redirect(getAuthUrl(state));
}
