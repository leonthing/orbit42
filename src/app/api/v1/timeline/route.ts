import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { fetchTimeBlocks } from "@/lib/insights";
import { listEventPosts } from "@/lib/event-posts";
import {
  completedKeysFor,
  completedPairsFor,
  completionKeyForBlock,
} from "@/lib/event-completions-query";

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
  // scope: "me"(기본) | "following" — 팔로우한 사람들의 공개 캘린더 일정
  const scope = url.searchParams.get("scope") === "following" ? "following" : "me";

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

  // 타임라인은 "실제로 한 일"의 기록이다. 캘린더에 잡혀 있던 예정이 아니라
  // 완료 체크한 일정만 올린다.
  const pastBlocks = blocks
    .filter((b) => b.start.getTime() <= now.getTime()) // 지나간 시간만
    .filter((b) => !calendarId || b.calendar_id === calendarId);
  const doneKeys = await completedKeysFor(
    userId,
    pastBlocks.map((b) => completionKeyForBlock(b.id)),
  );

  const items = pastBlocks
    .filter((b) => doneKeys.has(completionKeyForBlock(b.id)))
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

  if (scope === "following") {
    const { listFollowing } = await import("@/lib/follows");
    const people = await listFollowing(session.username);
    const peopleById = new Map(
      people.map((p) => {
        const person = p as {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        };
        return [person.id, person] as const;
      }),
    );
    if (peopleById.size === 0) return Response.json({ items: [], calendars: [] });

    // 팔로워/전체 공개 캘린더만 (나는 팔로워이므로 followers 도 포함), 비공개 사용자 제외.
    const [calsRes, privRes] = await Promise.all([
      db
        .from("calendars")
        .select("id, user_id, name, color, goal_title, visibility")
        .in("user_id", Array.from(peopleById.keys()))
        .in("visibility", ["followers", "public"]),
      db.from("users").select("id, is_private").in("id", Array.from(peopleById.keys())),
    ]);
    const privateIds = new Set(
      (privRes.data ?? []).filter((r) => r.is_private).map((r) => r.id as string),
    );
    const visibleCals = (calsRes.data ?? []).filter(
      (c) => !privateIds.has(c.user_id as string),
    );
    if (visibleCals.length === 0) return Response.json({ items: [], calendars: [] });

    const calMetaById = new Map(visibleCals.map((c) => [c.id as string, c]));
    const { data: rows } = await db
      .from("events")
      .select("id, title, start_at, end_at, all_day, calendar_id, user_id")
      .in("calendar_id", Array.from(calMetaById.keys()))
      .gte("start_at", rangeStart.toISOString())
      .lte("start_at", now.toISOString())
      .order("start_at", { ascending: false })
      .limit(200);

    const keys = (rows ?? []).map((r) => r.id as string);
    const photoByEvent = new Map<string, { image_urls: string[]; note: string | null }>();
    if (keys.length > 0) {
      const { data: postRows } = await db
        .from("event_posts")
        .select("event_key, image_urls, note, visibility, user_id")
        .in("event_key", keys)
        .in("visibility", ["followers", "public"]);
      for (const p of postRows ?? []) {
        photoByEvent.set(p.event_key as string, {
          image_urls: (p.image_urls as string[] | null) ?? [],
          note: (p.note as string | null) ?? null,
        });
      }
    }

    // 남의 타임라인도 같은 규칙 — 그 사람이 완료 체크한 일정만 보여준다.
    const donePairs = await completedPairsFor(
      Array.from(new Set((rows ?? []).map((r) => r.user_id as string))),
      (rows ?? []).map((r) => `local:${r.id as string}`),
    );

    const followingItems = (rows ?? [])
      .filter((r) => donePairs.has(`${r.user_id as string}|local:${r.id as string}`))
      .map((r) => {
      const cal = calMetaById.get(r.calendar_id as string);
      const person = peopleById.get(r.user_id as string);
      const photo = photoByEvent.get(r.id as string);
      const start = new Date(r.start_at as string);
      const end = new Date((r.end_at as string | null) ?? (r.start_at as string));
      return {
        id: r.id as string,
        title: r.title as string,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay: Boolean(r.all_day),
        hours: r.all_day
          ? null
          : Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10,
        calendarId: r.calendar_id as string,
        calendarName: (cal?.name as string) ?? null,
        calendarColor: (cal?.color as string) ?? "#6366f1",
        goalTitle: (cal?.goal_title as string | null) ?? null,
        imageUrls: photo?.image_urls ?? [],
        note: photo?.note ?? null,
        visibility: (cal?.visibility as string) ?? null,
        authorUsername: person?.username ?? null,
        authorName: person?.display_name ?? person?.username ?? null,
        authorAvatarUrl: person?.avatar_url ?? null,
      };
    });

    return Response.json({
      items: followingItems.filter((i) => !onlyPhotos || i.imageUrls.length > 0),
      calendars: [],
    });
  }

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
