import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup"];

// Sub-paths under /[username] that require the visitor to be the owner.
const OWNER_ONLY_SEGMENTS = ["settings", "calendar", "slots", "bookings", "network"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  const isBlogSubdomain = hostname.startsWith("blog.");
  if (isBlogSubdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/blog-public${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/blog-public") ||
    pathname.includes(".") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  const parts = pathname.split("/").filter(Boolean);
  const urlUsername = parts[0];
  const subSegment = parts[1];

  // Public profile and other non-owner-only sub-paths (e.g. /[username], /[username]/profile, /[username]/blog/post)
  const requiresOwner = subSegment && OWNER_ONLY_SEGMENTS.includes(subSegment);
  if (!requiresOwner) {
    return NextResponse.next();
  }

  const raw = request.cookies.get("orbit42_session")?.value;
  if (!raw) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const session = JSON.parse(raw);
    if (session.username !== urlUsername) {
      return NextResponse.redirect(new URL(`/${session.username}/calendar`, request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
