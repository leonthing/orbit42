import { apiUserId } from "@/lib/api-auth";
import { setPeopleImport } from "@/lib/people";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// PUT — 캘린더에서 사람 찾기 { importEnabled: boolean }.
// 끄면 캘린더에서 읽은 만남과 고르지 않은 제안을 지운다.
export async function PUT(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { importEnabled?: unknown };
  if (typeof body.importEnabled !== "boolean") {
    return Response.json({ error: "importEnabled 가 필요해요." }, { status: 400 });
  }
  await setPeopleImport(userId, body.importEnabled);
  return Response.json({ ok: true });
}
