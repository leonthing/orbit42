import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  exchangeCode,
  saveGoogleTokens,
  saveExtraGoogleAccount,
  fetchGoogleEmail,
  fetchGoogleProfile,
} from "@/lib/google";
import { getAdminClient } from "@/lib/supabase";
import { loginOrSignupWithGoogle, getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state") || "";

  // Landing-page sign-in/sign-up (no session yet).
  // state format: "signin" (existing user only) or "signin:<ref>"
  // for a fresh signup crediting a referrer username.
  if (stateRaw === "signin" || stateRaw.startsWith("signin:")) {
    const referrerRef = stateRaw.startsWith("signin:")
      ? stateRaw.slice("signin:".length)
      : "";
    if (!code) {
      return NextResponse.redirect(
        new URL("/?error=google_auth_failed", request.url),
      );
    }
    try {
      const tokens = await exchangeCode(code);
      const { email, name } = await fetchGoogleProfile(tokens);
      if (!email) {
        return NextResponse.redirect(
          new URL("/?error=google_no_email", request.url),
        );
      }
      const res = await loginOrSignupWithGoogle(email, name, referrerRef || null);
      if ("error" in res) {
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent(res.error)}`, request.url),
        );
      }
      return NextResponse.redirect(new URL("/feed", request.url));
    } catch (err) {
      console.error("google signin", err);
      return NextResponse.redirect(
        new URL("/?error=google_auth_failed", request.url),
      );
    }
  }

  // state formats: "username", "username:returnTo", "username:returnTo:add"
  const parts = stateRaw.split(":");
  const username = parts[0] || "";
  const returnTo = parts[1] || "";
  const mode = parts[2] || "primary";

  if (!code || !username) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Bind the callback to the logged-in session: the account whose Google
  // tokens we save must be the caller's own. Without this, an attacker can
  // replay a `code` with `state=<victim>` (or trick a victim into a link with
  // `state=<attacker>`) to link Google accounts across users. state is not a
  // trust boundary; the session cookie (now HMAC-signed) is.
  const session = await getSession();
  if (!session || session.username !== username) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeCode(code);

    const db = getAdminClient();
    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("username", username)
      .single();
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (mode === "add") {
      const email = await fetchGoogleEmail(tokens);
      await saveExtraGoogleAccount(user.id, tokens, email);
    } else {
      await saveGoogleTokens(user.id, tokens);
    }

    const redirectPath = returnTo ? `/${username}/${returnTo}` : `/${username}/calendar`;
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/${username}/settings?error=google_auth_failed`, request.url),
    );
  }
}
