import { apiSession } from "@/lib/api-auth";
import { disconnectGoogleCalendar } from "@/app/[username]/calendar/actions";

export const dynamic = "force-dynamic";

// POST — 기본 구글 캘린더 연결 해제 (Bearer 폴백으로 본인 세션에서 동작)
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  await disconnectGoogleCalendar();
  return Response.json({ ok: true });
}
