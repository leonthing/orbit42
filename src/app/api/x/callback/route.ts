import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeXCode, saveXTokens } from "@/lib/social";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state") || "";

  // State format: "username:verifier" or "username:returnTo:verifier"
  const parts = stateRaw.split(":");
  const verifier = parts.pop() || "";
  const username = parts[0] || "";
  const returnTo = parts.length > 1 ? parts[1] : "";

  if (!code || !username || !verifier) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Bind to the caller's own session — state is attacker-controllable and is
  // not a trust boundary (see OAuth account-linking CSRF).
  const session = await getSession();
  if (!session || session.username !== username) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeXCode(code, verifier);

    const db = getAdminClient();
    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Get X username
    let xUsername: string | undefined;
    try {
      const meRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        xUsername = meData.data?.username;
      }
    } catch {}

    await saveXTokens(user.id, tokens, xUsername);

    const redirectPath = returnTo
      ? `/${username}/${returnTo}`
      : `/${username}/settings?success=x_connected`;
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error("X OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/${username}/settings?error=x_auth_failed`, request.url)
    );
  }
}
