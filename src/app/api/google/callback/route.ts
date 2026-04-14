import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  exchangeCode,
  saveGoogleTokens,
  saveExtraGoogleAccount,
  fetchGoogleEmail,
} from "@/lib/google";
import { getAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state") || "";

  // state formats: "username", "username:returnTo", "username:returnTo:add"
  const parts = stateRaw.split(":");
  const username = parts[0] || "";
  const returnTo = parts[1] || "";
  const mode = parts[2] || "primary";

  if (!code || !username) {
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
