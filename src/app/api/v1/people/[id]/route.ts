import { apiUserId } from "@/lib/api-auth";
import { getPersonDetail, updatePerson, type PersonPatch } from "@/lib/people";

export const dynamic = "force-dynamic";

// GET — 한 사람: 요약과 지난/다가오는 만남
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const detail = await getPersonDetail(userId, params.id);
  if (!detail) return Response.json({ error: "사람을 찾을 수 없어요." }, { status: 404 });
  return Response.json(detail);
}

// PATCH — { status?: active|archived|dismissed, name?, company?, role?, memo?, dismissNudge? }
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: PersonPatch = {};
  if (body.status === "active" || body.status === "archived" || body.status === "dismissed") {
    patch.status = body.status;
  }
  if (typeof body.name === "string") patch.name = body.name;
  for (const key of ["company", "role", "memo"] as const) {
    if (typeof body[key] === "string" || body[key] === null) patch[key] = body[key] as string | null;
  }
  if (body.dismissNudge === true) patch.dismissNudge = true;
  try {
    await updatePerson(userId, params.id, patch);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
