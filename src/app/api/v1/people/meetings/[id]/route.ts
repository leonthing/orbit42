import { apiUserId } from "@/lib/api-auth";
import { deleteMeeting } from "@/lib/people";

export const dynamic = "force-dynamic";

// DELETE — 직접 남긴 만남 지우기 (캘린더·예약에서 온 것은 지울 수 없다)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  await deleteMeeting(userId, params.id);
  return Response.json({ ok: true });
}
