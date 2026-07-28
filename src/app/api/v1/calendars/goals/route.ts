import { apiSession, apiUserId } from "@/lib/api-auth";
import { listCalendarGoals } from "@/lib/calendar-goals";

export const dynamic = "force-dynamic";

/**
 * GET — 목표가 설정된 캘린더들의 진행 상황.
 * 계산은 `lib/calendar-goals` 가 담당하고 웹 자산 페이지와 공용한다.
 */
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const includeArchived =
    new URL(request.url).searchParams.get("includeArchived") === "1";
  return Response.json({ goals: await listCalendarGoals(userId, includeArchived) });
}
