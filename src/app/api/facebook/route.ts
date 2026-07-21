import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getFacebookAuthUrl } from "@/lib/social";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = session;
  const returnTo = new URL(request.url).searchParams.get("return") || "";
  const state = returnTo ? `${username}:${returnTo}` : username;
  const url = getFacebookAuthUrl(state);

  return NextResponse.redirect(url);
}
