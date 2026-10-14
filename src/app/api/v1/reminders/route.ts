import { apiUserId } from "@/lib/api-auth";
import { listActiveReminders } from "@/lib/event-annotations";

export const dynamic = "force-dynamic";

// GET — 내게 걸린 다시 알림(지금 이후, 날짜순). 앱이 열릴 때 기기 알림으로 예약하고 목록에 보여 준다. 본인만.
export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  return Response.json({ reminders: await listActiveReminders(userId) });
}
