import { apiSession } from "@/lib/api-auth";
import { follow, unfollow, isFollowing } from "@/lib/follows";

export const dynamic = "force-dynamic";

// POST { follow: boolean } — 궤도에 추가/제거
export async function POST(
  request: Request,
  { params }: { params: { username: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (session.username === params.username) {
    return Response.json({ error: "나를 팔로우할 수는 없어요." }, { status: 400 });
  }

  let body: { follow?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (typeof body.follow !== "boolean") {
    return Response.json({ error: "follow 값이 필요해요." }, { status: 400 });
  }

  const result = body.follow
    ? await follow(params.username)
    : await unfollow(params.username);
  if (result && "error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ isFollowing: await isFollowing(params.username) });
}
