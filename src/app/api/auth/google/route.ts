import { NextResponse } from "next/server";
import { getSignInUrl } from "@/lib/google";

// GET /api/auth/google → redirect to Google OAuth for sign-in / sign-up.
export async function GET() {
  return NextResponse.redirect(getSignInUrl("signin"));
}
