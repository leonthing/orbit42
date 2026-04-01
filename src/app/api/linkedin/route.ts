import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getLinkedInAuthUrl } from "@/lib/social";

export async function GET(request: NextRequest) {
  const session = cookies().get("orbit42_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = JSON.parse(session);
  const returnTo = new URL(request.url).searchParams.get("return") || "";
  const state = returnTo ? `${username}:${returnTo}` : username;
  const url = getLinkedInAuthUrl(state);

  return NextResponse.redirect(url);
}
