import { apiSession } from "@/lib/api-auth";
import { removeAvailability } from "@/lib/slots";

export const dynamic = "force-dynamic";

// DELETE — 수동 시간 창 삭제 (소유권은 removeAvailability가 검증)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; windowId: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await removeAvailability(params.windowId);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
