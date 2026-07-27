import { apiSession, apiUserId } from "@/lib/api-auth";
import { setEventEarning } from "@/lib/time-asset";

export const dynamic = "force-dynamic";

// PUT { eventId, amountKrw: number | null }
// 개별 일정의 실제 수익 기록. null 이면 해제(자동 계산으로 복귀).
// eventId 는 로컬 이벤트 uuid 또는 "gcal_..." 문자열 (event-bucket 과 동일).
export async function PUT(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let body: { eventId?: string; amountKrw?: number | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const eventId = (body.eventId ?? "").trim();
  if (!eventId || eventId.length > 300) {
    return Response.json({ error: "eventId가 필요해요." }, { status: 400 });
  }
  let amount: number | null = null;
  if (body.amountKrw !== null && body.amountKrw !== undefined) {
    amount = Number(body.amountKrw);
    if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000_000) {
      return Response.json({ error: "금액이 올바르지 않아요." }, { status: 400 });
    }
  }

  const result = await setEventEarning(userId, eventId, amount);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
