import { apiSession } from "@/lib/api-auth";
import { blockUser, unblockUser, isBlocked } from "@/lib/blocks";

export const dynamic = "force-dynamic";

// POST { block: boolean } — 차단/차단 해제.
// 차단 시 서버가 양방향 팔로우(오르빗)도 함께 제거한다.
export async function POST(
  request: Request,
  { params }: { params: { username: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { block?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (typeof body.block !== "boolean") {
    return Response.json({ error: "block 값이 필요해요." }, { status: 400 });
  }

  const result = body.block
    ? await blockUser(params.username)
    : await unblockUser(params.username);
  if (result && "error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ isBlocked: await isBlocked(params.username) });
}
