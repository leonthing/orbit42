import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getProfile } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { listFollowing } from "@/lib/follows";
import { getPublicEvents } from "@/lib/public-calendar";
import { getReactionsForMany } from "@/lib/reactions";
import { listFeedPostsByAuthors } from "@/lib/feed-posts";
import { isGoogleCalendarConnected } from "@/app/[username]/calendar/actions";
import { ReactionStrip } from "@/components/ReactionStrip";
import { ComposeBox } from "@/components/ComposeBox";
import { DeleteFeedPostButton } from "@/components/DeleteFeedPostButton";
import { Avatar } from "@/components/Avatar";
import { PublicChrome } from "@/components/layout/PublicChrome";

export const metadata: Metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

type Author = { username: string; display_name: string | null; avatar_url: string | null };

type FeedItem =
  | {
      kind: "event";
      id: string;
      timestamp: string;
      author: Author;
      title: string;
      end_at: string;
      all_day: boolean;
      calendar_color: string;
    }
  | {
      kind: "post";
      id: string;
      timestamp: string;
      author: Author;
      title: string;
      slug: string;
      excerpt: string | null;
    }
  | {
      kind: "slot";
      id: string;
      timestamp: string;
      author: Author;
      title: string;
      slug: string;
      duration_min: number;
      price_cents: number;
      slot_type: string;
    }
  | {
      kind: "feed_post";
      id: string;
      timestamp: string;
      author: Author;
      body: string;
      image_urls: string[];
      location_label: string | null;
      attached_event_id: string | null;
    };

export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [following, viewerProfile, googleConnected] = await Promise.all([
    listFollowing(session.username),
    getProfile(session.username),
    isGoogleCalendarConnected().catch(() => false),
  ]);

  const db = getAdminClient();
  const { data: viewerRow } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  const viewerId = viewerRow?.id as string | undefined;

  const authorMap = new Map<string, Author>();
  if (viewerId && viewerProfile) {
    authorMap.set(viewerId, {
      username: viewerProfile.username,
      display_name: viewerProfile.display_name,
      avatar_url: (viewerProfile.avatar_url as string | null) ?? null,
    });
  }
  for (const u of following) {
    authorMap.set(u.id, {
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
    });
  }

  // viewer + following IDs (so my own posts also appear)
  const authorIds = Array.from(authorMap.keys());

  // Time windows
  const now = new Date();
  const eventsHorizon = new Date(now.getTime() + 14 * 24 * 60 * 60_000);
  const recentSince = new Date(now.getTime() - 14 * 24 * 60 * 60_000);

  const [postsRes, slotsRes, feedPostsRes, eventLists] = await Promise.all([
    db
      .from("blog_posts")
      .select("id, slug, title, excerpt, published_at, user_id")
      .eq("published", true)
      .in("user_id", authorIds)
      .gte("published_at", recentSince.toISOString())
      .order("published_at", { ascending: false })
      .limit(40),
    db
      .from("time_slots")
      .select("id, slug, title, duration_min, price_cents, slot_type, created_at, host_id")
      .eq("active", true)
      .in("host_id", authorIds)
      .gte("created_at", recentSince.toISOString())
      .order("created_at", { ascending: false })
      .limit(40),
    listFeedPostsByAuthors(authorIds, 60),
    Promise.all(
      [...following].slice(0, 25).map(async (u) => {
        try {
          const evs = await getPublicEvents(u.username, now, eventsHorizon);
          return evs.map((e) => ({
            ...e,
            author: {
              username: u.username,
              display_name: u.display_name,
              avatar_url: u.avatar_url,
            },
          }));
        } catch {
          return [];
        }
      }),
    ),
  ]);

  const items: FeedItem[] = [];

  for (const p of postsRes.data ?? []) {
    const author = authorMap.get(p.user_id as string);
    if (!author || !p.published_at) continue;
    items.push({
      kind: "post",
      id: p.id as string,
      timestamp: p.published_at as string,
      author,
      title: (p.title as string) || "(제목 없음)",
      slug: p.slug as string,
      excerpt: (p.excerpt as string | null) ?? null,
    });
  }
  for (const s of slotsRes.data ?? []) {
    const author = authorMap.get(s.host_id as string);
    if (!author) continue;
    items.push({
      kind: "slot",
      id: s.id as string,
      timestamp: s.created_at as string,
      author,
      title: s.title as string,
      slug: s.slug as string,
      duration_min: s.duration_min as number,
      price_cents: s.price_cents as number,
      slot_type: s.slot_type as string,
    });
  }
  for (const fp of feedPostsRes) {
    const author = authorMap.get(fp.user_id);
    if (!author) continue;
    items.push({
      kind: "feed_post",
      id: fp.id,
      timestamp: fp.created_at,
      author,
      body: fp.body,
      image_urls: fp.image_urls ?? [],
      location_label: fp.location_label,
      attached_event_id: fp.attached_event_id,
    });
  }
  for (const list of eventLists) {
    for (const e of list) {
      items.push({
        kind: "event",
        id: e.id,
        timestamp: e.start_at,
        author: e.author,
        title: e.title,
        end_at: e.end_at,
        all_day: e.all_day,
        calendar_color: e.calendar_color,
      });
    }
  }

  // Sort: upcoming events first by start time, then everything else by recency.
  items.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    const nowMs = now.getTime();
    const aFuture = a.kind === "event" && ta >= nowMs;
    const bFuture = b.kind === "event" && tb >= nowMs;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    if (aFuture && bFuture) return ta - tb;
    return tb - ta;
  });

  // Bulk fetch reactions
  const eventIds = items.filter((i) => i.kind === "event").map((i) => i.id);
  const slotIds = items.filter((i) => i.kind === "slot").map((i) => i.id);
  const postIds = items.filter((i) => i.kind === "post").map((i) => i.id);
  const feedPostIds = items.filter((i) => i.kind === "feed_post").map((i) => i.id);
  const [eventReactions, slotReactions, postReactions, feedPostReactions] =
    await Promise.all([
      getReactionsForMany("event", eventIds),
      getReactionsForMany("slot", slotIds),
      getReactionsForMany("post", postIds),
      getReactionsForMany("feed_post", feedPostIds),
    ]);

  const dayGroups = groupByDay(items, now);

  return (
    <PublicChrome viewerUsername={session.username}>
      <FeedHeader />

      {viewerProfile && (
        <div className="mb-6">
          <ComposeBox
            viewerUsername={viewerProfile.username}
            viewerName={viewerProfile.display_name || viewerProfile.username}
            viewerAvatarUrl={(viewerProfile.avatar_url as string | null) ?? null}
            googleConnected={googleConnected}
          />
        </div>
      )}

      {following.length === 0 && items.length === 0 ? (
        <EmptyState
          title="아직 궤도가 비어있어요"
          body="관심 있는 사람을 팔로우(Orbit)하면 그들의 일정과 글이 여기에 흘러들어옵니다."
          cta={{ href: "/explore", label: "사람 찾아보기" }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="첫 글을 올려보세요"
          body="위 입력창에서 지금 무엇을 하고 있는지 한 마디 남겨보세요."
        />
      ) : (
        <DailyCalendar
          days={dayGroups}
          viewerUsername={session.username}
          reactions={{
            event: eventReactions,
            slot: slotReactions,
            post: postReactions,
            feed_post: feedPostReactions,
          }}
        />
      )}

      <section className="mt-10 rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-charcoal-200">
            Orbiting ({following.length})
          </h3>
          <Link href="/explore" className="text-xs text-amber-400 hover:text-amber-300">
            Find more →
          </Link>
        </div>
        {following.length === 0 ? (
          <p className="mt-3 text-xs text-charcoal-500">
            아직 팔로우한 사람이 없어요. <Link href="/explore" className="text-amber-400 hover:underline">Explore</Link>에서 찾아보세요.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {following.map((u) => (
              <Link
                key={u.id}
                href={`/${u.username}`}
                className="rounded-full border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-1 text-xs text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
              >
                {u.display_name || u.username}
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicChrome>
  );
}

function FeedHeader() {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-charcoal-100">Feed</h1>
      <p className="mt-1 text-sm text-charcoal-500">
        궤도 위 사람들의 일정, 글, 슬롯
      </p>
    </header>
  );
}

type DayGroup = {
  key: string;
  date: Date;
  dayOffset: number; // 0 = today, 1 = tomorrow, -1 = yesterday
  items: FeedItem[];
};

function DailyCalendar({
  days,
  reactions,
  viewerUsername,
}: {
  days: DayGroup[];
  reactions: {
    event: Map<string, import("@/lib/reactions-types").ReactionSummary[]>;
    slot: Map<string, import("@/lib/reactions-types").ReactionSummary[]>;
    post: Map<string, import("@/lib/reactions-types").ReactionSummary[]>;
    feed_post: Map<string, import("@/lib/reactions-types").ReactionSummary[]>;
  };
  viewerUsername: string;
}) {
  return (
    <div className="space-y-6">
      {days.map((day) => (
        <DayCard key={day.key} day={day}>
          {day.items.map((item) => (
            <DayEntry
              key={`${item.kind}-${item.id}`}
              item={item}
              viewerUsername={viewerUsername}
              reactions={
                item.kind === "event"
                  ? reactions.event.get(item.id) ?? []
                  : item.kind === "slot"
                    ? reactions.slot.get(item.id) ?? []
                    : item.kind === "post"
                      ? reactions.post.get(item.id) ?? []
                      : reactions.feed_post.get(item.id) ?? []
              }
            />
          ))}
        </DayCard>
      ))}
    </div>
  );
}

function DayCard({
  day,
  children,
}: {
  day: DayGroup;
  children: React.ReactNode;
}) {
  const monthDay = day.date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
  const weekday = day.date.toLocaleDateString("ko-KR", { weekday: "long" });
  const isToday = day.dayOffset === 0;
  const isPast = day.dayOffset < 0;
  const relative =
    day.dayOffset === 0
      ? "오늘"
      : day.dayOffset === 1
        ? "내일"
        : day.dayOffset === -1
          ? "어제"
          : day.dayOffset > 0
            ? `+${day.dayOffset}일`
            : `${day.dayOffset}일`;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-charcoal-900/30 ${
        isToday
          ? "border-amber-500/50 shadow-[0_0_0_1px_rgb(245_158_11_/_0.2)]"
          : "border-charcoal-800/60"
      }`}
    >
      <header
        className={`flex items-baseline justify-between border-b px-5 py-3 ${
          isToday
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-charcoal-800/50"
        }`}
      >
        <div className="flex items-baseline gap-3">
          <span
            className={`text-lg font-bold ${
              isPast ? "text-charcoal-400" : "text-charcoal-100"
            }`}
          >
            {monthDay}
          </span>
          <span className="text-xs text-charcoal-500">{weekday}</span>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isToday
              ? "bg-amber-500 text-charcoal-950"
              : isPast
                ? "bg-charcoal-800 text-charcoal-500"
                : "bg-navy-600/25 text-navy-300"
          }`}
        >
          {relative}
        </span>
      </header>
      <div className="relative px-3 py-3 md:px-4">
        {/* left rail — thin dashed line running through all entries */}
        <div className="pointer-events-none absolute bottom-3 left-[10px] top-3 w-px bg-charcoal-800/60 md:left-[14px]" />
        <ul className="space-y-2.5">{children}</ul>
      </div>
    </article>
  );
}

function DayEntry({
  item,
  reactions,
  viewerUsername,
}: {
  item: FeedItem;
  reactions: import("@/lib/reactions-types").ReactionSummary[];
  viewerUsername: string;
}) {
  return (
    <li className="relative pl-5 md:pl-7">
      {/* Tick on the rail */}
      <span
        className={`absolute top-[18px] -ml-[11px] h-2 w-2 shrink-0 rounded-full ring-2 ring-[rgb(var(--bg-surface))] md:-ml-[15px] ${
          item.kind === "slot"
            ? "bg-amber-400"
            : item.kind === "event"
              ? "bg-emerald-400"
              : "bg-charcoal-500"
        }`}
      />
      <EntryBody item={item} reactions={reactions} viewerUsername={viewerUsername} />
    </li>
  );
}

function EntryBody({
  item,
  reactions,
  viewerUsername,
}: {
  item: FeedItem;
  reactions: import("@/lib/reactions-types").ReactionSummary[];
  viewerUsername: string;
}) {
  const isMine = item.author.username === viewerUsername;
  const author = item.author;
  const timeStr = formatTimeShort(item.timestamp);
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-3 md:p-4">
      <div className="flex items-center gap-2 text-xs">
        <Link
          href={`/${author.username}`}
          title={`${author.display_name || author.username} (@${author.username})`}
        >
          <Avatar
            url={author.avatar_url}
            name={author.display_name || author.username}
            size={24}
          />
        </Link>
        <Link
          href={`/${author.username}`}
          className="truncate font-semibold text-charcoal-200 hover:text-charcoal-100"
        >
          {author.display_name || author.username}
        </Link>
        <span className="hidden truncate text-charcoal-600 sm:inline">
          @{author.username}
        </span>
        <span className="font-medium tabular-nums text-charcoal-500">
          · {timeStr}
        </span>
        <KindBadge kind={item.kind} />
        {isMine && item.kind === "feed_post" && (
          <div className="ml-auto">
            <DeleteFeedPostButton id={item.id} />
          </div>
        )}
      </div>

      {item.kind === "event" && (
        <div className="mt-3 flex items-start gap-3">
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.calendar_color }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-charcoal-100">{item.title}</p>
            <p className="mt-0.5 text-xs text-charcoal-500">
              {formatEventTime(item.timestamp, item.end_at, item.all_day)}
            </p>
          </div>
        </div>
      )}

      {item.kind === "post" && (
        <Link href={`/${author.username}/blog/${item.slug}`} className="mt-3 block">
          <p className="text-base font-semibold text-charcoal-100 hover:text-amber-300">
            {item.title}
          </p>
          {item.excerpt && (
            <p className="mt-1 line-clamp-2 text-sm text-charcoal-400">{item.excerpt}</p>
          )}
        </Link>
      )}

      {item.kind === "slot" && (
        <Link
          href={`/${author.username}/s/${item.slug}`}
          className="mt-3 block rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 hover:border-amber-500/60"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-charcoal-100">
              {item.title}
            </p>
            <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">
              {item.price_cents === 0
                ? "FREE"
                : `₩${(item.price_cents / 100).toLocaleString("ko-KR")}`}
            </span>
          </div>
          <p className="mt-1 text-xs text-charcoal-500">
            {item.duration_min}분 · {item.slot_type}
          </p>
        </Link>
      )}

      {item.kind === "feed_post" && (
        <div className="mt-3 space-y-3">
          {item.attached_event_id && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              📅 일정 공유
            </div>
          )}
          {item.body && (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-charcoal-100">
              {item.body}
            </p>
          )}
          {item.image_urls.length > 0 && (
            <div
              className={`grid gap-2 ${
                item.image_urls.length === 1
                  ? "grid-cols-1"
                  : item.image_urls.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-2"
              }`}
            >
              {item.image_urls.map((src, i) => (
                <div
                  key={i}
                  className="relative aspect-video overflow-hidden rounded-xl border border-charcoal-800/60 bg-charcoal-800/30"
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}
          {item.location_label && (
            <p className="text-xs text-charcoal-500">📍 {item.location_label}</p>
          )}
        </div>
      )}

      <div className="mt-3">
        <ReactionStrip
          target_type={item.kind === "feed_post" ? "feed_post" : item.kind}
          target_id={item.id}
          initial={reactions}
          loggedIn
          size="sm"
        />
      </div>
    </div>
  );
}

function formatTimeShort(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KindBadge({ kind }: { kind: FeedItem["kind"] }) {
  const map: Record<FeedItem["kind"], { label: string; color: string }> = {
    event: { label: "일정", color: "bg-emerald-700/30 text-emerald-300" },
    feed_post: { label: "글", color: "bg-charcoal-700/40 text-charcoal-300" },
    post: { label: "긴 글", color: "bg-navy-700/30 text-navy-300" },
    slot: { label: "슬롯", color: "bg-amber-700/30 text-amber-300" },
  };
  const m = map[kind];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.color}`}>
      {m.label}
    </span>
  );
}

function formatEventTime(start: string, end: string, allDay: boolean) {
  const s = new Date(start);
  if (allDay) {
    return s.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }
  const e = new Date(end);
  return `${s.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })} – ${e.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function dayKeyOf(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupByDay(items: FeedItem[], now: Date): DayGroup[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayKey = dayKeyOf(startOfToday);

  const map = new Map<string, DayGroup>();
  for (const item of items) {
    const ts = new Date(item.timestamp);
    const dayStart = new Date(ts);
    dayStart.setHours(0, 0, 0, 0);
    const key = dayKeyOf(dayStart);
    if (!map.has(key)) {
      const offset = Math.round(
        (dayStart.getTime() - startOfToday.getTime()) / (24 * 60 * 60_000),
      );
      map.set(key, { key, date: dayStart, dayOffset: offset, items: [] });
    }
    map.get(key)!.items.push(item);
  }

  // Sort each day's items chronologically within the day.
  for (const g of Array.from(map.values())) {
    g.items.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  // Order days: today first, then future ascending, then past descending.
  return Array.from(map.values()).sort((a, b) => {
    if (a.key === todayKey) return -1;
    if (b.key === todayKey) return 1;
    const af = a.dayOffset > 0;
    const bf = b.dayOffset > 0;
    if (af && !bf) return -1;
    if (!af && bf) return 1;
    if (af && bf) return a.dayOffset - b.dayOffset;
    return b.dayOffset - a.dayOffset;
  });
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-charcoal-800/60 p-10 text-center">
      <p className="text-sm font-semibold text-charcoal-200">{title}</p>
      <p className="mt-2 text-sm text-charcoal-500">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-charcoal-950 hover:bg-amber-400"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
