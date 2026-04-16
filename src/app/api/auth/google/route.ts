import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSignInUrl } from "@/lib/google";

// GET /api/auth/google → redirect to Google OAuth for sign-in / sign-up.
// Accepts ?code=XYZ (invite code) which is forwarded via OAuth state
// so fresh signups can still be gated.
export async function GET(request: NextRequest) {
  const inviteCode = (request.nextUrl.searchParams.get("code") ?? "").toUpperCase();
  const state = inviteCode ? `signin:${inviteCode}` : "signin";
  return NextResponse.redirect(getSignInUrl(state));
}
