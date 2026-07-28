import { apiSession, apiUserId } from "@/lib/api-auth";
import { listMembers, addMember, removeMember } from "@/lib/calendar-members";

export const dynamic = "force-dynamic";

async function requireUser(request: Request) {
  const session = await apiSession(request);
  if (!session) return null;
  return apiUserId(request);
}

// GET — 이 캘린더를 함께 쓰는 사람들
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUser(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const result = await listMembers(params.id);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  // 접근 권한 확인 — 소유자이거나 멤버여야 목록을 볼 수 있다.
  if (!result.some((m) => m.userId === userId)) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }
  return Response.json({ members: result });
}

// POST { username, role? } — 함께 쓰기 초대
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUser(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  let body: { username?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.username) {
    return Response.json({ error: "username이 필요해요." }, { status: 400 });
  }
  const role = body.role === "viewer" ? "viewer" : "editor";
  const result = await addMember(userId, params.id, body.username, role);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const members = await listMembers(params.id);
  return Response.json({ members: "error" in members ? [] : members });
}

// DELETE ?userId=... — 내보내기 / 나가기 (userId 생략 시 나 자신)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUser(request);
  if (!userId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const targetId = new URL(request.url).searchParams.get("userId") ?? userId;
  const result = await removeMember(userId, params.id, targetId);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const members = await listMembers(params.id);
  return Response.json({ members: "error" in members ? [] : members });
}
