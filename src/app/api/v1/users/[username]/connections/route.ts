import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { listFollowers, listFollowing } from "@/lib/follows";
import { isBlockedEitherWay } from "@/lib/blocks";

export const dynamic = "force-dynamic";

// GET ?type=orbiters|orbiting — 오르비터(나를 담은)/오르빗(내가 담은) 목록.
// 비공개 프로필·차단 관계는 타인 조회 시 접근 불가 (users/[username]과 동일 규칙).
export async function GET(
  request: Request,
  { params }: { params: { username: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "";
  if (type !== "orbiters" && type !== "orbiting") {
    return Response.json({ error: "type이 올바르지 않아요." }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: target } = await db
    .from("users")
    .select("id, username, is_private")
    .eq("username", params.username)
    .maybeSingle();
  if (!target) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const isMe = session.username === target.username;
  if (!isMe) {
    if (target.is_private) {
      return Response.json({ error: "비공개 프로필이에요." }, { status: 403 });
    }
    const myId = await apiUserId(request);
    if (myId && (await isBlockedEitherWay(myId, target.id as string))) {
      return Response.json({ error: "프로필을 볼 수 없어요." }, { status: 403 });
    }
  }

  const rows =
    type === "orbiters"
      ? await listFollowers(target.username as string)
      : await listFollowing(target.username as string);

  // 목록 안의 비공개 사용자는 타인에게 숨기고, 관심사 태그를 함께 조회한다.
  const ids = rows.map((r) => (r as { id: string }).id);
  let privateIds = new Set<string>();
  const interestsById = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: metaRows } = await db
      .from("users")
      .select("id, is_private, interests")
      .in("id", ids);
    if (!isMe) {
      privateIds = new Set(
        (metaRows ?? []).filter((r) => r.is_private).map((r) => r.id as string),
      );
    }
    for (const r of metaRows ?? []) {
      interestsById.set(r.id as string, (r.interests as string[] | null) ?? []);
    }
  }

  return Response.json({
    users: rows
      .filter((r) => !privateIds.has((r as { id: string }).id))
      .map((r) => {
        const u = r as {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        };
        return {
          username: u.username,
          displayName: u.display_name,
          avatarUrl: u.avatar_url,
          interests: interestsById.get(u.id) ?? [],
        };
      }),
  });
}
