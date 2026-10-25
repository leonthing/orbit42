import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/session";
import { PAT_PURPOSE, patAllows } from "@/lib/pat-scope";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/forbidden",
  "/b", // 게스트 예약 관리 (개선-40) — 로그인 없이, 토큰은 '#' 뒤
];

// Sub-paths under /[username] that require the visitor to be the owner.
const OWNER_ONLY_SEGMENTS = ["settings", "calendar", "slots", "bookings"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  const isBlogSubdomain = hostname.startsWith("blog.");
  if (isBlogSubdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/blog-public${pathname}`;
    return NextResponse.rewrite(url);
  }

  // 개인 액세스 토큰은 허용 목록(일정·예약 읽기 + 완료 체크) 밖에서는 아예 막는다 —
  // 서버 액션처럼 Bearer 를 받아 주는 다른 경로로 새지 않게.
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const bearer = await verifySession(authorization.slice(7).trim());
    if (bearer?.purpose === PAT_PURPOSE && !patAllows(request.method, pathname)) {
      return NextResponse.json({ error: "이 토큰으로는 쓸 수 없는 기능이에요." }, { status: 403 });
    }
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

  const session = await verifySession(
    request.cookies.get("orbit42_session")?.value,
  );
  if (!session || session.purpose) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session.username !== urlUsername) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
