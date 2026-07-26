import { apiSession, apiUserId } from "@/lib/api-auth";
import { getTimeAssetSummary } from "@/lib/time-asset";

export const dynamic = "force-dynamic";

// GET — 이번 주 시간 자산 요약 (버킷 분석 + 환산 + 4주 추이 + 실거래 + 인사이트)
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const summary = await getTimeAssetSummary(userId, session.username);
  return Response.json(summary);
}
