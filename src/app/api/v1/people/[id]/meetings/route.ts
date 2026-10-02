import { apiUserId } from "@/lib/api-auth";
import { logMeeting } from "@/lib/people";

export const dynamic = "force-dynamic";

// POST — "만났어요": 캘린더에 없던 만남 기록 { title?, at?, minutes? }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await logMeeting(userId, params.id, {
      title: typeof body.title === "string" ? body.title : null,
      at: typeof body.at === "string" ? body.at : null,
      minutes: typeof body.minutes === "number" ? body.minutes : null,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
