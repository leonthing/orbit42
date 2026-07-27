import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { listEventPosts } from "@/lib/event-posts";
import { isBlockedEitherWay } from "@/lib/blocks";

export const dynamic = "force-dynamic";

// GET — 사용자의 시간 로그 (완료된 시간의 사진 기록).
// 본인: 전체 / 팔로워: followers+public / 그 외: public.
// 비공개 프로필·차단 관계는 타인 조회 불가 (users/[username]과 동일 규칙).
export async function GET(
  request: Request,
  { params }: { params: { username: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
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
  let viewer: "me" | "follower" | "public" = "me";
  if (!isMe) {
    if (target.is_private) {
      return Response.json({ error: "비공개 프로필이에요." }, { status: 403 });
    }
    const myId = await apiUserId(request);
    if (!myId) {
      return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    }
    if (await isBlockedEitherWay(myId, target.id as string)) {
      return Response.json({ error: "프로필을 볼 수 없어요." }, { status: 403 });
    }
    const { data: follow } = await db
      .from("follows")
      .select("id")
      .eq("follower_id", myId)
      .eq("following_id", target.id as string)
      .maybeSingle();
    viewer = follow ? "follower" : "public";
  }

  const posts = await listEventPosts(target.id as string, viewer);
  return Response.json({
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      startAt: p.start_at,
      endAt: p.end_at,
      allDay: p.all_day,
      note: p.note,
      imageUrls: p.image_urls,
      visibility: p.visibility,
    })),
  });
}
