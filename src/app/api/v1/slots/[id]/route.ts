import { apiSession } from "@/lib/api-auth";
import { toApiSlot } from "@/lib/api-slots";
import { listMySlots, updateSlot } from "@/lib/slots";

export const dynamic = "force-dynamic";

// PATCH { active: boolean } — 활성/비활성 토글 (host 본인 소유만, updateSlot이 검증)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { active?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return Response.json({ error: "active 값이 필요해요." }, { status: 400 });
  }

  const result = await updateSlot(params.id, { active: body.active });
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const updated = (await listMySlots()).find((s) => s.id === params.id);
  if (!updated) {
    return Response.json({ error: "슬롯을 찾을 수 없어요." }, { status: 404 });
  }
  return Response.json({ slot: toApiSlot(updated, session.username) });
}
