import { apiSession } from "@/lib/api-auth";
import { acceptTimeRequest } from "@/lib/time-requests";

export const dynamic = "force-dynamic";

// POST { startAt } — 받은 시간 요청 수락 (웹 받은 예약 화면과 같은 함수: 확정 예약·구글 반영·요청자 알림)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  let body: { startAt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const startAt = Date.parse(body.startAt ?? "");
  if (Number.isNaN(startAt)) {
    return Response.json({ error: "시간을 골라 주세요." }, { status: 400 });
  }
  const result = await acceptTimeRequest(params.id, new Date(startAt).toISOString());
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: result.error === "요청을 찾을 수 없어요." ? 404 : 400 });
  }
  return Response.json({ ok: true });
}
