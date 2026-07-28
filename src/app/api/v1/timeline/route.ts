import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { fetchTimeBlocks } from "@/lib/insights";
import { listEventPosts } from "@/lib/event-posts";

export const dynamic = "force-dynamic";

/**
 * GET ?months=3&calendarId=... — 내 타임라인.
 *
 * 지난 일정을 최신순으로 늘어놓고, 사진 기록(event_posts)이 있으면 함께 붙인다.
 * 캘린더(=목표/일기 캘린더)로 좁혀 보면 그 목표를 향한 여정이 된다.
 */
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const url = new URL(request.url);
  const months = Math.min(12, Math.max(1, Number(url.searchParams.get("months") ?? 3)));
  const calendarId = url.searchParams.get("calendarId");
  const onlyPhotos = url.searchParams.get("onlyPhotos") === "1";

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const rangeEnd = new Date(now.getTime() + 24 * 3_600_000); // 오늘까지 (+여유)

  const db = getAdminClient();
  const [blocks, posts, calRes] = await Promise.all([
    fetchTimeBlocks(userId, rangeStart, rangeEnd),
    listEventPosts(userId, "me", 200),
    db
      .from("calendars")
      .select("id, name, color, goal_title")
      .eq("user_id", userId),
  ]);

  const calById = new Map(
    (calRes.data ?? []).map((c) => [
      c.id as string,
      {
        name: c.name as string,
        color: (c.color as string) ?? "#6366f1",
        goalTitle: (c.goal_title as string | null) ?? null,
      },
    ]),
  );

  // 사진 기록은 클라이언트 원형 id(uuid / gcal_*)로 저장돼 있고
  // 블록 id 는 native:/구글캘린더::  형식이라 키를 맞춰 조회한다.
  const postByKey = new Map(posts.map((p) => [p.event_key, p]));
  const postFor = (blockId: string) => {
    if (blockId.startsWith("native:")) {
      return postByKey.get(blockId.slice("native:".length));
    }
    const sep = blockId.indexOf("::");
    if (sep >= 0) return postByKey.get(`gcal_${blockId.slice(sep + 2)}`);
    return postByKey.get(blockId);
  };
  const eventIdOf = (blockId: string) => {
    if (blockId.startsWith("native:")) return blockId.slice("native:".length);
    const sep = blockId.indexOf("::");
    if (sep >= 0) return `gcal_${blockId.slice(sep + 2)}`;
    return blockId;
  };

  const items = blocks
    .filter((b) => b.start.getTime() <= now.getTime()) // 지나간 시간만
    .filter((b) => !calendarId || b.calendar_id === calendarId)
    .map((b) => {
      const post = postFor(b.id);
      const cal = calById.get(b.calendar_id);
      return {
        id: eventIdOf(b.id),
        title: b.title,
        startAt: b.start.toISOString(),
        endAt: b.end.toISOString(),
        allDay: b.all_day,
        hours: b.all_day
          ? null
          : Math.round(((b.end.getTime() - b.start.getTime()) / 3_600_000) * 10) / 10,
        calendarId: b.calendar_id,
        calendarName: cal?.name ?? b.calendar_name,
        calendarColor: cal?.color ?? b.calendar_color,
        goalTitle: cal?.goalTitle ?? null,
        imageUrls: post?.image_urls ?? [],
        note: post?.note ?? null,
        visibility: post?.visibility ?? null,
      };
    })
    .filter((item) => !onlyPhotos || item.imageUrls.length > 0)
    .sort((a, b) => (a.startAt < b.startAt ? 1 : -1))
    .slice(0, 200);

  return Response.json({
    items,
    calendars: Array.from(calById.entries()).map(([id, c]) => ({
      id,
      name: c.name,
      color: c.color,
      goalTitle: c.goalTitle,
    })),
  });
}
