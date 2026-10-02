import { apiUserId } from "@/lib/api-auth";
import { addPerson, getOrbit } from "@/lib/people";

export const dynamic = "force-dynamic";

// GET — 관계 궤도: 궤도 위의 사람(가까운 순), 캘린더에서 찾은 제안, 보관함, 안부 넛지.
// 읽기 전용이다. 새 만남을 반영하려면 먼저 POST /people/sync.
export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  return Response.json(await getOrbit(userId));
}

// POST — 사람 직접 추가 { name, email?, company?, role?, memo? }
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const id = await addPerson(userId, {
      name: String(body.name ?? ""),
      email: typeof body.email === "string" ? body.email : null,
      company: typeof body.company === "string" ? body.company : null,
      role: typeof body.role === "string" ? body.role : null,
      memo: typeof body.memo === "string" ? body.memo : null,
    });
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
