import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeFacebookCode, getFacebookPages, saveFacebookTokens } from "@/lib/social";
import { getAdminClient } from "@/lib/supabase";

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

  try {
    const tokens = await exchangeFacebookCode(code);

    const db = getAdminClient();
    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Get user's pages and use the first one
    const pages = await getFacebookPages(tokens.access_token);

    if (pages.length > 0) {
      const page = pages[0];
      await saveFacebookTokens(user.id, page.id, page.access_token, page.name);
    } else {
      // No pages - save user token for share fallback
      await saveFacebookTokens(user.id, "", tokens.access_token, "");
    }

    const redirectPath = returnTo
      ? `/${username}/${returnTo}`
      : `/${username}/settings?success=facebook_connected`;
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error("Facebook OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/${username}/settings?error=facebook_auth_failed`, request.url)
    );
  }
}
