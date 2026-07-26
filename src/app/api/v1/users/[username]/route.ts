import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { getFollowStats, isFollowing } from "@/lib/follows";
import { isBlocked, isBlockedEitherWay } from "@/lib/blocks";
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
    .select("id, username, display_name, avatar_url, bio, interests, is_private")
    .eq("username", params.username)
    .maybeSingle();
  if (!user) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const isMe = session.username === user.username;

  // 비공개 프로필: 본인 외에는 조회 불가 (직접 공유한 예약 링크는 별개).
  if (!isMe && user.is_private) {
    return Response.json({ error: "비공개 프로필이에요." }, { status: 403 });
  }

  // 상대가 나를 차단한 경우: 조회 불가. 내가 차단한 경우: 차단 상태로 응답
  // (해제 버튼을 보여주기 위해).
  let blockedByMe = false;
  if (!isMe) {
    const myId = await apiUserId(request);
    if (myId) {
      blockedByMe = await isBlocked(user.username as string);
      if (!blockedByMe && (await isBlockedEitherWay(myId, user.id as string))) {
        return Response.json({ error: "프로필을 볼 수 없어요." }, { status: 403 });
      }
    }
  }

  const [stats, following, rating, slots] = await Promise.all([
    getFollowStats(user.username as string),
    blockedByMe ? Promise.resolve(false) : isFollowing(user.username as string),
    getHostRating(user.id as string),
    blockedByMe
      ? Promise.resolve([])
      : listPublicSlotsByUsername(user.username as string),
  ]);

  return Response.json({
    user: {
      username: user.username,
      displayName: (user.display_name as string | null) ?? null,
      avatarUrl: (user.avatar_url as string | null) ?? null,
      bio: blockedByMe ? null : ((user.bio as string | null) ?? null),
      interests: blockedByMe ? [] : ((user.interests as string[] | null) ?? []),
    },
    orbiters: stats.followers,
    orbiting: stats.following,
    isFollowing: following,
    isMe,
    isBlocked: blockedByMe,
    rating: rating ? { average: rating.average, count: rating.count } : null,
    slots: slots.map((s) => toApiSlot(s, user.username as string)),
  });
}
