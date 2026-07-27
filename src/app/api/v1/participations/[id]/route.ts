import { apiSession, apiUserId } from "@/lib/api-auth";
import { respondToInvite } from "@/lib/event-participants";

export const dynamic = "force-dynamic";

// POST { status: "accepted" | "declined" } — 받은 일정 초대에 응답
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (body.status !== "accepted" && body.status !== "declined") {
    return Response.json({ error: "status가 올바르지 않아요." }, { status: 400 });
  }

  const result = await respondToInvite(userId, params.id, body.status);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true, status: body.status });
}
