import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeLinkedInCode, getLinkedInProfile, saveLinkedInTokens } from "@/lib/social";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state") || "";
  const [username, returnTo] = stateRaw.includes(":")
    ? stateRaw.split(":", 2)
    : [stateRaw, ""];

  if (!code || !username) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Bind to the caller's own session — state is attacker-controllable and is
  // not a trust boundary (see OAuth account-linking CSRF).
  const session = await getSession();
  if (!session || session.username !== username) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeLinkedInCode(code);

    const db = getAdminClient();
    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const profile = await getLinkedInProfile(tokens.access_token);
    await saveLinkedInTokens(user.id, tokens, profile || undefined);

    const redirectPath = returnTo
      ? `/${username}/${returnTo}`
      : `/${username}/settings?success=linkedin_connected`;
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error("LinkedIn OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/${username}/settings?error=linkedin_auth_failed`, request.url)
    );
  }
}
