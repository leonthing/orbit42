import { getSignInUrl } from "@/lib/google";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET — 모바일 "Google로 계속하기" 시작 URL (로그인 전이므로 인증 불필요).
// 콜백은 state="mobile-signin" 분기에서 Bearer 토큰을 orbit42:// 로 전달한다.
export async function GET() {
  const limit = rateLimit(clientKey("google-signin-url"), 20, 5 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: `너무 많은 시도예요. ${limit.retryAfter}초 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }
  return Response.json({ url: getSignInUrl("mobile-signin") });
}
