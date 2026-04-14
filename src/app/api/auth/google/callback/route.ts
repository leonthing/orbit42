import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeSignInCode, fetchGoogleProfile } from "@/lib/google";
import { loginOrSignupWithGoogle } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=google_auth_failed", request.url));
  }
  try {
    const tokens = await exchangeSignInCode(code);
    const { email, name } = await fetchGoogleProfile(tokens);
    if (!email) {
      return NextResponse.redirect(
        new URL("/?error=google_no_email", request.url),
      );
    }
    const res = await loginOrSignupWithGoogle(email, name);
    if ("error" in res) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(res.error)}`, request.url),
      );
    }
    return NextResponse.redirect(new URL("/feed", request.url));
  } catch (err) {
    console.error("google signin callback", err);
    return NextResponse.redirect(
      new URL("/?error=google_auth_failed", request.url),
    );
  }
}
