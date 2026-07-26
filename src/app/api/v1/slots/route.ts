import { apiSession } from "@/lib/api-auth";
import { toApiSlot } from "@/lib/api-slots";
import { listMySlots } from "@/lib/slots";

export const dynamic = "force-dynamic";

// GET — 내 슬롯 목록. getSession의 Bearer 폴백 덕에 listMySlots를 그대로 호출.
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const slots = await listMySlots();
  return Response.json({
    slots: slots.map((s) => toApiSlot(s, session.username)),
  });
}
