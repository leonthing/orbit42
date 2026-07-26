import { apiSession, issuePurposeToken } from "@/lib/api-auth";
import {
  getXAuthUrl,
  getFacebookAuthUrl,
  getLinkedInAuthUrl,
} from "@/lib/social";

export const dynamic = "force-dynamic";

// GET ?provider=x|facebook|linkedin — 모바일용 소셜 OAuth 시작 URL.
// 구글 연결과 동일한 방식: state = "mobile:<10분 단일목적 토큰>"
// (X는 lib가 뒤에 ":<PKCE verifier>"를 덧붙인다 — 콜백에서 pop)
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const provider = new URL(request.url).searchParams.get("provider") ?? "";
  if (!["x", "facebook", "linkedin"].includes(provider)) {
    return Response.json({ error: "알 수 없는 서비스예요." }, { status: 400 });
  }

  const token = await issuePurposeToken(session.username, "social-connect", 600);
  const state = `mobile:${token}`;

  if (provider === "x") {
    return Response.json({ url: getXAuthUrl(state).url });
  }
  if (provider === "facebook") {
    return Response.json({ url: getFacebookAuthUrl(state) });
  }
  return Response.json({ url: getLinkedInAuthUrl(state) });
}
