import { apiSession } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { getFollowStats, isFollowing } from "@/lib/follows";
import { getHostRating } from "@/lib/reviews";
import { listPublicSlotsByUsername } from "@/lib/slots";
import { toApiSlot } from "@/lib/api-slots";

export const dynamic = "force-dynamic";

// GET — 타인 공개 프로필 (헤더 + 팔로우 상태 + 평점 + 열린 슬롯)
export async function GET(
  request: Request,
  { params }: { params: { username: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id, username, display_name, avatar_url, bio, interests")
    .eq("username", params.username)
    .maybeSingle();
  if (!user) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const [stats, following, rating, slots] = await Promise.all([
    getFollowStats(user.username as string),
    isFollowing(user.username as string),
    getHostRating(user.id as string),
    listPublicSlotsByUsername(user.username as string),
  ]);

  return Response.json({
    user: {
      username: user.username,
      displayName: (user.display_name as string | null) ?? null,
      avatarUrl: (user.avatar_url as string | null) ?? null,
      bio: (user.bio as string | null) ?? null,
      interests: (user.interests as string[] | null) ?? [],
    },
    orbiters: stats.followers,
    orbiting: stats.following,
    isFollowing: following,
    isMe: session.username === user.username,
    rating: rating ? { average: rating.average, count: rating.count } : null,
    slots: slots.map((s) => toApiSlot(s, user.username as string)),
  });
}
