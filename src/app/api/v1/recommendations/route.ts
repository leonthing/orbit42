import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — 팔로우 추천: 아직 팔로우하지 않은 공개 사용자.
// 내 관심사와 겹치는 사람이 앞에 오고, 나머지는 최근 가입 순.
// (초기엔 사용자가 적어 사실상 전원 노출에 가깝다 — 온보딩·오르빗 탭 공용)
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const myId = await apiUserId(request);
  if (!myId) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const db = getAdminClient();
  const [{ data: me }, { data: followRows }, { data: blockRows }] =
    await Promise.all([
      db.from("users").select("interests").eq("id", myId).single(),
      db.from("follows").select("following_id").eq("follower_id", myId),
      db
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`),
    ]);

  const excluded = new Set<string>([myId]);
  for (const f of followRows ?? []) excluded.add(f.following_id as string);
  for (const b of blockRows ?? []) {
    excluded.add(b.blocker_id as string);
    excluded.add(b.blocked_id as string);
  }

  const myInterests = new Set(
    ((me?.interests as string[] | null) ?? []).map((t) =>
      t.trim().toLowerCase(),
    ),
  );

  const { data: candidates } = await db
    .from("users")
    .select("id, username, display_name, avatar_url, bio, interests, is_private")
    .order("created_at", { ascending: false })
    .limit(200);

  // 겹치는 관심사 수로 정렬 (동률이면 최근 가입 순 유지 — sort는 stable).
  const scored = (candidates ?? [])
    .filter((u) => !u.is_private && !excluded.has(u.id as string))
    .map((u) => {
      const tags = (u.interests as string[] | null) ?? [];
      const overlap = tags.filter((t) =>
        myInterests.has(t.trim().toLowerCase()),
      );
      const rest = tags.filter(
        (t) => !myInterests.has(t.trim().toLowerCase()),
      );
      return { u, overlapCount: overlap.length, ordered: [...overlap, ...rest] };
    })
    .sort((a, b) => b.overlapCount - a.overlapCount);

  return Response.json({
    users: scored.slice(0, 20).map(({ u, overlapCount, ordered }) => ({
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      interests: ordered,
      overlapCount,
    })),
  });
}
