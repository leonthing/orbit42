import { apiSession } from "@/lib/api-auth";
import { archiveSlot } from "@/lib/slots";

export const dynamic = "force-dynamic";

// POST — 예약 링크 보관(비공개 + 목록·링크에서 뺌). 예약 기록·관리 링크·리마인더는 그대로 (개선-45)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await archiveSlot(params.id);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
