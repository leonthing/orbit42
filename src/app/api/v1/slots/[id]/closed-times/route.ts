import { apiSession } from "@/lib/api-auth";
import { closeSlotTime, reopenSlotTime } from "@/lib/slots";

export const dynamic = "force-dynamic";

// POST { startAt, closed? } — closed 가 false 면 다시 예약 받기, 아니면 이 시간 예약 안 받기
// DELETE { startAt } — 다시 예약 받기
async function handle(
  request: Request,
  params: { id: string },
  fn?: typeof closeSlotTime,
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { startAt?: string; closed?: boolean } | null;
  if (!body?.startAt) {
    return Response.json({ error: "시간을 알려주세요." }, { status: 400 });
  }
  const action = fn ?? (body.closed === false ? reopenSlotTime : closeSlotTime);
  const result = await action(params.id, body.startAt);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return handle(request, params);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return handle(request, params, reopenSlotTime);
}
