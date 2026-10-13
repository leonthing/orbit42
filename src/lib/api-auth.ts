/**
 * Bearer-token auth for the mobile JSON API (/api/v1/*).
 *
 * Tokens reuse the same HMAC-signed session format as the web cookie
 * (lib/session), with an embedded expiry so a leaked token eventually dies.
 * Route handlers call `apiSession(request)` instead of reading cookies.
 */

import { getAdminClient } from "@/lib/supabase";
import { signSession, verifySession, type SessionData } from "@/lib/session";
import { PAT_PURPOSE, patAllows } from "@/lib/pat-scope";

const TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 90; // 90 days

export async function issueApiToken(username: string): Promise<string> {
  return signSession({
    username,
    exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE_SEC,
  });
}

export async function apiSession(
  request: Request,
): Promise<SessionData | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const session = await verifySession(header.slice(7).trim());
  // 개인 액세스 토큰: 허용 목록(읽기 + 완료 체크)의 API 만, 폐기되지 않았을 때만.
  if (session?.purpose === PAT_PURPOSE) {
    if (!session.pat) return null;
    if (!patAllows(request.method, new URL(request.url).pathname)) return null;
    const { isPersonalAccessTokenActive } = await import("@/lib/pat");
    if (!(await isPersonalAccessTokenActive(session.pat, session.username))) return null;
    return { username: session.username };
  }
  // 단일 목적 토큰(OAuth state 등)은 API 세션으로 인정하지 않는다.
  if (session?.purpose) return null;
  return session;
}

/** 특정 용도의 단기 토큰 발급 (예: 모바일 Google OAuth state). */
export async function issuePurposeToken(
  username: string,
  purpose: string,
  maxAgeSec: number,
): Promise<string> {
  return signSession({
    username,
    purpose,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  });
}

/** Resolve the bearer session to a users.id, or null if unauthenticated. */
export async function apiUserId(request: Request): Promise<string | null> {
  const session = await apiSession(request);
  if (!session) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  return (data?.id as string | undefined) ?? null;
}

/** The user shape every /api/v1 auth endpoint returns. */
export type ApiUser = {
  username: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export async function loadApiUser(username: string): Promise<ApiUser | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("username, display_name, email, avatar_url, email_verified")
    .eq("username", username)
    .single();
  if (!data) return null;
  return {
    username: data.username as string,
    displayName: (data.display_name as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    emailVerified: Boolean(data.email_verified),
  };
}

/** 200 payload with a fresh token for the given username.
 * isNew: 이번 요청으로 계정이 새로 만들어졌는지 — 클라이언트 온보딩 트리거. */
export async function tokenResponse(
  username: string,
  isNew = false,
): Promise<Response> {
  const [token, user] = await Promise.all([
    issueApiToken(username),
    loadApiUser(username),
  ]);
  if (!user) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  return Response.json({ token, user, isNew });
}
