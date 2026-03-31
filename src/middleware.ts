import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // Blog subdomain: blog.orbit42.org or blog.localhost
  const isBlogSubdomain = hostname.startsWith("blog.");
  if (isBlogSubdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/blog-public${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/blog-public") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Check session
  const raw = request.cookies.get("orbit42_session")?.value;
  if (!raw) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const session = JSON.parse(raw);
    // Extract username from URL: /leo/dashboard → leo
    const urlUsername = pathname.split("/")[1];

    // Only allow access to own routes
    if (session.username !== urlUsername) {
      return NextResponse.redirect(new URL(`/${session.username}/dashboard`, request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
