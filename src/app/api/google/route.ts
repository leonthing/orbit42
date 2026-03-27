import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthUrl } from "@/lib/google";

// GET /api/google → redirect to Google OAuth
export async function GET(request: NextRequest) {
  const session = cookies().get("orbit42_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = JSON.parse(session);
  const returnTo = new URL(request.url).searchParams.get("return") || "";
  const state = returnTo ? `${username}:${returnTo}` : username;
  const url = getAuthUrl(state);
  // DEBUG: return URL as JSON to inspect
  return NextResponse.json({
    url,
    client_id: process.env.GOOGLE_CLIENT_ID?.slice(0, 20),
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    site_url: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
