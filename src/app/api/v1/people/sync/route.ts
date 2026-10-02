import { apiUserId } from "@/lib/api-auth";
import { syncPeople } from "@/lib/people";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST — 팔로우·예약·일정 참석자를 반영하고, 켜져 있으면 구글 캘린더 참석자도
// 다시 읽는다(6시간 간격, { force: true } 면 즉시).
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  await syncPeople(userId, { force: body.force === true });
  return Response.json({ ok: true });
}
