import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeFacebookCode, getFacebookPages, saveFacebookTokens } from "@/lib/social";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state") || "";
  const [username, returnTo] = stateRaw.includes(":")
    ? stateRaw.split(":", 2)
    : [stateRaw, ""];

  // Mobile: state = "mobile:<purpose token>"
  if (username === "mobile") {
    const { resolveMobileOAuthUser } = await import("@/lib/mobile-oauth");
    const mobile = await resolveMobileOAuthUser(
      stateRaw.slice("mobile:".length),
      "social-connect",
    );
    if (!mobile || !code) {
      return NextResponse.redirect("orbit42://social-error?provider=facebook");
    }
    try {
      const tokens = await exchangeFacebookCode(code);
      const pages = await getFacebookPages(tokens.access_token);
      if (pages.length > 0) {
        const page = pages[0];
        await saveFacebookTokens(mobile.userId, page.id, page.access_token, page.name);
      } else {
        await saveFacebookTokens(mobile.userId, "", tokens.access_token, "");
      }
      return NextResponse.redirect("orbit42://social-connected?provider=facebook");
    } catch (err) {
      console.error("Facebook OAuth error (mobile):", err);
      return NextResponse.redirect("orbit42://social-error?provider=facebook");
    }
  }

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
