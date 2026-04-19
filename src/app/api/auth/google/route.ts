import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSignInUrl } from "@/lib/google";

// GET /api/auth/google → redirect to Google OAuth for sign-in / sign-up.
// Accepts ?ref=<username> which is forwarded via OAuth state so fresh
// Google signups get credited to the referrer.
export async function GET(request: NextRequest) {
  const rawRef = (request.nextUrl.searchParams.get("ref") ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const state = rawRef ? `signin:${rawRef}` : "signin";
  return NextResponse.redirect(getSignInUrl(state));
}
