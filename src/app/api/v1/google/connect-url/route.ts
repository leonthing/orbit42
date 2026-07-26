import { apiSession, issuePurposeToken } from "@/lib/api-auth";
import { getAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

// GET ?add=1 — 모바일용 Google OAuth 시작 URL.
// state = "mobile:<10분 단일목적 토큰>[:add]" — 콜백이 쿠키 대신 이 토큰으로
// 사용자를 식별한다 (ASWebAuthenticationSession에는 웹 세션 쿠키가 없음).
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const add = new URL(request.url).searchParams.get("add") === "1";
  const token = await issuePurposeToken(session.username, "gcal-connect", 600);
  const state = `mobile:${token}${add ? ":add" : ""}`;
  return Response.json({ url: getAuthUrl(state) });
}
