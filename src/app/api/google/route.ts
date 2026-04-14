import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthUrl } from "@/lib/google";

// GET /api/google?return=...&add=1 → redirect to Google OAuth
export async function GET(request: NextRequest) {
  const session = cookies().get("orbit42_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = JSON.parse(session);
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return") || "";
  const add = url.searchParams.get("add");

  const state = [username, returnTo, add ? "add" : ""].join(":");
  return NextResponse.redirect(getAuthUrl(state));
}
