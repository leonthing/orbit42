import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserId } from "@/lib/db";
import { getAdminClient } from "@/lib/supabase";
import { fetchTimeBlocks } from "@/lib/insights";
import { listEventPosts } from "@/lib/event-posts";
import {
  completedKeysFor,
  completedPairsFor,
  completionKeyForBlock,
} from "@/lib/event-completions-query";
import { listFollowing } from "@/lib/follows";
import { TimelineFeed, type TimelineEntry } from "./TimelineFeed";

export const metadata: Metadata = { title: "타임라인" };
export const dynamic = "force-dynamic";

/**
 * 타임라인 — 지나간 일정을 최신순으로 보는 내 시간의 기록 (iOS 타임라인 탭과 동일).
 * scope=following 이면 팔로우한 사람들의 공개 캘린더 일정이 흐른다.
 */
export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { scope?: string; calendarId?: string; photos?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.username !== params.username) notFound();
  const userId = await getUserId();
  if (!userId) notFound();

  const scope = searchParams.scope === "following" ? "following" : "me";
  const onlyPhotos = searchParams.photos === "1";
  const db = getAdminClient();

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const { data: calRows } = await db
    .from("calendars")
    .select("id, name, color, goal_title")
    .eq("user_id", userId);
  const calendars = (calRows ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    color: (c.color as string) ?? "#6366f1",
    goalTitle: (c.goal_title as string | null) ?? null,
  }));

  let entries: TimelineEntry[] = [];

  if (scope === "me") {
    const [blocks, posts] = await Promise.all([
      fetchTimeBlocks(userId, rangeStart, new Date(now.getTime() + 86_400_000)),
      listEventPosts(userId, "me", 200),
    ]);
    const postByKey = new Map(posts.map((p) => [p.event_key, p]));
    const postFor = (blockId: string) => {
      if (blockId.startsWith("native:")) return postByKey.get(blockId.slice(7));
      const sep = blockId.indexOf("::");
      if (sep >= 0) return postByKey.get(`gcal_${blockId.slice(sep + 2)}`);
      return postByKey.get(blockId);
    };
    const calById = new Map(calendars.map((c) => [c.id, c]));

    // 타임라인은 "실제로 한 일"의 기록 — 완료 체크한 일정만 올린다.
    const pastBlocks = blocks
      .filter((b) => b.start.getTime() <= now.getTime())
      .filter((b) => !searchParams.calendarId || b.calendar_id === searchParams.calendarId);
    const doneKeys = await completedKeysFor(
      userId,
      pastBlocks.map((b) => completionKeyForBlock(b.id)),
    );

    entries = pastBlocks
      .filter((b) => doneKeys.has(completionKeyForBlock(b.id)))
      .map((b) => {
        const post = postFor(b.id);
        const cal = calById.get(b.calendar_id);
        return {
          id: b.id,
          title: b.title,
          startAt: b.start.toISOString(),
          hours: b.all_day
            ? null
            : Math.round(((b.end.getTime() - b.start.getTime()) / 3_600_000) * 10) / 10,
          allDay: b.all_day,
          calendarName: cal?.name ?? b.calendar_name,
          calendarColor: cal?.color ?? b.calendar_color,
          goalTitle: cal?.goalTitle ?? null,
          imageUrls: post?.image_urls ?? [],
          note: post?.note ?? null,
          authorName: null,
        };
      })
      .filter((e) => !onlyPhotos || e.imageUrls.length > 0)
      .sort((a, b) => (a.startAt < b.startAt ? 1 : -1))
      .slice(0, 150);
  } else {
    // 팔로우한 사람들의 공개(팔로워/전체) 캘린더 일정
    const people = await listFollowing(session.username);
    const peopleById = new Map(
      people.map((p) => {
        const person = p as {
          id: string;
          username: string;
          display_name: string | null;
        };
        return [person.id, person] as const;
      }),
    );
    if (peopleById.size > 0) {
      const ids = Array.from(peopleById.keys());
      const [calsRes, privRes] = await Promise.all([
        db
          .from("calendars")
          .select("id, user_id, name, color, goal_title")
          .in("user_id", ids)
          .in("visibility", ["followers", "public"]),
        db.from("users").select("id, is_private").in("id", ids),
      ]);
      const privateIds = new Set(
        (privRes.data ?? []).filter((r) => r.is_private).map((r) => r.id as string),
      );
      const visible = (calsRes.data ?? []).filter(
        (c) => !privateIds.has(c.user_id as string),
      );
      if (visible.length > 0) {
        const metaById = new Map(visible.map((c) => [c.id as string, c]));
        const { data: rows } = await db
          .from("events")
          .select("id, title, start_at, end_at, all_day, calendar_id, user_id")
          .in("calendar_id", Array.from(metaById.keys()))
          .gte("start_at", rangeStart.toISOString())
          .lte("start_at", now.toISOString())
          .order("start_at", { ascending: false })
          .limit(150);

        const keys = (rows ?? []).map((r) => r.id as string);
        const photoByEvent = new Map<string, { urls: string[]; note: string | null }>();
        if (keys.length > 0) {
          const { data: postRows } = await db
            .from("event_posts")
            .select("event_key, image_urls, note")
            .in("event_key", keys)
            .in("visibility", ["followers", "public"]);
          for (const p of postRows ?? []) {
            photoByEvent.set(p.event_key as string, {
              urls: (p.image_urls as string[] | null) ?? [],
              note: (p.note as string | null) ?? null,
            });
          }
        }

        // 남의 기록도 같은 규칙 — 그 사람이 완료 체크한 것만.
        const donePairs = await completedPairsFor(
          Array.from(new Set((rows ?? []).map((r) => r.user_id as string))),
          (rows ?? []).map((r) => `local:${r.id as string}`),
        );

        entries = (rows ?? [])
          .filter((r) => donePairs.has(`${r.user_id as string}|local:${r.id as string}`))
          .map((r) => {
            const cal = metaById.get(r.calendar_id as string);
            const person = peopleById.get(r.user_id as string);
            const photo = photoByEvent.get(r.id as string);
            const start = new Date(r.start_at as string);
            const end = new Date((r.end_at as string | null) ?? (r.start_at as string));
            return {
              id: r.id as string,
              title: r.title as string,
              startAt: start.toISOString(),
              hours: r.all_day
                ? null
                : Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10,
              allDay: Boolean(r.all_day),
              calendarName: (cal?.name as string) ?? null,
              calendarColor: (cal?.color as string) ?? "#6366f1",
              goalTitle: (cal?.goal_title as string | null) ?? null,
              imageUrls: photo?.urls ?? [],
              note: photo?.note ?? null,
              authorName: person?.display_name ?? person?.username ?? null,
            };
          })
          .filter((e) => !onlyPhotos || e.imageUrls.length > 0);
      }
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal-100">타임라인</h1>
        <p className="mt-1 text-xs text-charcoal-500">
          지나간 일정이 기록으로 쌓여요. 일정에 사진을 붙이면 더 선명해져요.
        </p>
      </header>

      <TimelineFeed
        entries={entries}
        calendars={calendars}
        username={params.username}
        scope={scope}
        calendarId={searchParams.calendarId ?? null}
        onlyPhotos={onlyPhotos}
      />
    </div>
  );
}
