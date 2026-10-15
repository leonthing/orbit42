import { apiSession } from "@/lib/api-auth";
import { declineTimeRequest } from "@/lib/time-requests";

export const dynamic = "force-dynamic";

// POST — 받은 시간 요청 거절 (웹과 같은 함수: 요청자에게 알림 한 건)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await declineTimeRequest(params.id);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: result.error === "요청을 찾을 수 없어요." ? 404 : 400 });
  }
  return Response.json({ ok: true });
}
