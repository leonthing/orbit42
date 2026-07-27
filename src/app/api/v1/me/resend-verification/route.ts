import { resendVerificationEmail } from "@/lib/account";

export const dynamic = "force-dynamic";

// POST — 미인증 이메일 재발송. resendVerificationEmail 내부의 getSession 이
// Bearer 폴백을 타므로 모바일 세션에서도 동작한다.
export async function POST() {
  const result = await resendVerificationEmail();
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
