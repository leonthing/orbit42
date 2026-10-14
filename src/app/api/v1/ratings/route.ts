import { apiUserId } from "@/lib/api-auth";
import { ratingSummary } from "@/lib/event-annotations";

export const dynamic = "force-dynamic";

// GET — 내 별점 모아 보기 (본인만). 이번 주·지난주 평균, 높은/낮은 일정, 캘린더별 평균(지난 90일).
export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  return Response.json(await ratingSummary(userId));
}
