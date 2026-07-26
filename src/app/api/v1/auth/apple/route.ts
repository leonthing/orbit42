import { verifyAppleIdentityToken } from "@/lib/apple-auth";
import { loginOrSignupWithApple } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { tokenResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST { identityToken: string, displayName?: string }
// displayName comes from ASAuthorizationAppleIDCredential.fullName, which
// Apple only provides on the very first authorization.
export async function POST(request: Request) {
  let body: { identityToken?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.identityToken) {
    return Response.json({ error: "Apple 토큰이 없어요." }, { status: 400 });
  }

  const limit = rateLimit(clientKey("api-apple"), 10, 5 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: `너무 많은 시도예요. ${limit.retryAfter}초 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }

  const identity = await verifyAppleIdentityToken(body.identityToken);
  if (!identity) {
    return Response.json(
      { error: "Apple 로그인 검증에 실패했어요. 다시 시도해주세요." },
      { status: 401 },
    );
  }

  const result = await loginOrSignupWithApple(
    identity.sub,
    identity.email,
    body.displayName?.trim() || null,
  );
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 401 });
  }
  return tokenResponse(result.username);
}
