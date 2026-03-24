import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthUrl } from "@/lib/google";

// GET /api/google → redirect to Google OAuth
export async function GET() {
  const session = cookies().get("orbit42_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = JSON.parse(session);
  const url = getAuthUrl(username);
  return NextResponse.redirect(url);
}
