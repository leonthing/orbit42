import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { listFollowing } from "@/lib/follows";
import { getPublicEvents } from "@/lib/public-calendar";
import { getReactionsForMany } from "@/lib/reactions";
import { ReactionStrip } from "@/components/ReactionStrip";
import { PublicChrome } from "@/components/layout/PublicChrome";

export const metadata: Metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

type Author = { username: string; display_name: string | null };

type FeedItem =
  | {
      kind: "event";
      id: string;
      timestamp: string; // start_at
      author: Author;
      title: string;
      end_at: string;
      all_day: boolean;
      calendar_color: string;
    }
  | {
      kind: "post";
      id: string;
      timestamp: string; // published_at
      author: Author;
      title: string;
      slug: string;
      excerpt: string | null;
    }
  | {
      kind: "slot";
      id: string;
      timestamp: string; // created_at
      author: Author;
      title: string;
      slug: string;
      duration_min: number;
      price_cents: number;
      slot_type: string;
    };

export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const following = await listFollowing(session.username);

  if (following.length === 0) {
    return (
      <PublicChrome viewerUsername={session.username}>
        <FeedHeader />
        <EmptyState
          title="아직 궤도가 비어있어요"
          body="관심 있는 사람을 팔로우(Orbit)하면 그들의 글, 일정, 슬롯이 여기에 흘러들어옵니다."
          cta={{ href: "/explore", label: "사람 찾아보기" }}
        />
      </PublicChrome>
    );
  }

  const followingMap = new Map(following.map((u) => [u.id, u]));
  const followingIds = following.map((u) => u.id);

  // Time windows
  const now = new Date();
  const eventsHorizon = new Date(now.getTime() + 14 * 24 * 60 * 60_000);
  const recentSince = new Date(now.getTime() - 14 * 24 * 60 * 60_000);

  // Pull posts + slots in parallel
  const db = getAdminClient();
  const [postsRes, slotsRes] = await Promise.all([
    db
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, published_at, user_id",
      )
      .eq("published", true)
      .in("user_id", followingIds)
      .gte("published_at", recentSince.toISOString())
      .order("published_at", { ascending: false })
      .limit(40),
    db
      .from("time_slots")
      .select("id, slug, title, duration_min, price_cents, slot_type, created_at, host_id")
      .eq("active", true)
      .in("host_id", followingIds)
      .gte("created_at", recentSince.toISOString())
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  // Pull events for each followed user (capped to recent activity)
  const eventLists = await Promise.all(
    following.slice(0, 25).map(async (u) => {
      try {
        const evs = await getPublicEvents(u.username, now, eventsHorizon);
        return evs.map((e) => ({ ...e, author: u }));
      } catch {
        return [];
      }
    }),
  );

  const items: FeedItem[] = [];

  for (const p of postsRes.data ?? []) {
    const author = followingMap.get(p.user_id as string);
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
    const author = followingMap.get(s.host_id as string);
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

  // Sort: events ascending by start_at, posts/slots descending by timestamp.
  // Mixed: most "interesting now" first — upcoming events first if soon, then recent activity.
  items.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    const nowMs = now.getTime();
    const aFuture = a.kind === "event" && ta >= nowMs;
    const bFuture = b.kind === "event" && tb >= nowMs;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    if (aFuture && bFuture) return ta - tb; // soonest event first
    return tb - ta; // recent activity first
  });

  // Bulk fetch reactions
  const eventIds = items.filter((i) => i.kind === "event").map((i) => i.id);
  const slotIds = items.filter((i) => i.kind === "slot").map((i) => i.id);
  const postIds = items.filter((i) => i.kind === "post").map((i) => i.id);
  const [eventReactions, slotReactions, postReactions] = await Promise.all([
    getReactionsForMany("event", eventIds),
    getReactionsForMany("slot", slotIds),
    getReactionsForMany("post", postIds),
  ]);

  const groups = groupItems(items, now);

  return (
    <PublicChrome viewerUsername={session.username}>
      <FeedHeader />
      {items.length === 0 ? (
        <EmptyState
          title="새로운 활동이 없어요"
          body="팔로우 중인 사람들이 글을 올리거나 일정을 공유하면 여기에 보입니다."
          cta={{ href: "/explore", label: "더 찾아보기" }}
        />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal-500">
                {g.label}
              </h2>
              <ul className="space-y-3">
                {g.items.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <FeedCard
                      item={item}
                      reactions={
                        item.kind === "event"
                          ? eventReactions.get(item.id) ?? []
                          : item.kind === "slot"
                            ? slotReactions.get(item.id) ?? []
                            : postReactions.get(item.id) ?? []
                      }
                      loggedIn
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="mt-10 rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-charcoal-200">
            Orbiting ({following.length})
          </h3>
          <Link href="/explore" className="text-xs text-navy-400 hover:text-navy-300">
            Find more →
          </Link>
        </div>
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

function FeedCard({
  item,
  reactions,
  loggedIn,
}: {
  item: FeedItem;
  reactions: import("@/lib/reactions-types").ReactionSummary[];
  loggedIn: boolean;
}) {
  const author = item.author;
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <div className="flex items-center gap-2 text-xs text-charcoal-500">
        <Link
          href={`/${author.username}`}
          className="font-medium text-charcoal-300 hover:text-charcoal-100"
        >
          {author.display_name || author.username}
        </Link>
        <span className="text-charcoal-600">@{author.username}</span>
        <span className="text-charcoal-700">·</span>
        <KindBadge kind={item.kind} />
      </div>

      {item.kind === "event" && (
        <div className="mt-3">
          <div className="flex items-start gap-3">
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
        </div>
      )}

      {item.kind === "post" && (
        <Link
          href={`/${author.username}/blog/${item.slug}`}
          className="mt-3 block"
        >
          <p className="text-base font-semibold text-charcoal-100 hover:text-navy-300">
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
          className="mt-3 block rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 p-3 hover:border-navy-500/60"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-charcoal-100">
              {item.title}
            </p>
            <span className="shrink-0 text-xs font-medium text-charcoal-400">
              {item.price_cents === 0
                ? "Free"
                : `${(item.price_cents / 100).toLocaleString("ko-KR")}원`}
            </span>
          </div>
          <p className="mt-1 text-xs text-charcoal-500">
            {item.duration_min}분 · {item.slot_type}
          </p>
        </Link>
      )}

      <div className="mt-3">
        <ReactionStrip
          target_type={item.kind}
          target_id={item.id}
          initial={reactions}
          loggedIn={loggedIn}
          size="sm"
        />
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: FeedItem["kind"] }) {
  const map: Record<FeedItem["kind"], { label: string; color: string }> = {
    event: { label: "일정", color: "bg-emerald-700/30 text-emerald-300" },
    post: { label: "글", color: "bg-navy-700/30 text-navy-300" },
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

function groupItems(items: FeedItem[], now: Date) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60_000);
  const startOfWeekEnd = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60_000);

  const groups: { label: string; items: FeedItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Tomorrow", items: [] },
    { label: "This week", items: [] },
    { label: "Later & recent", items: [] },
  ];

  for (const item of items) {
    const ts = new Date(item.timestamp);
    const isUpcomingEvent = item.kind === "event" && ts >= now;
    if (isUpcomingEvent) {
      if (ts < startOfTomorrow) groups[0].items.push(item);
      else if (ts < new Date(startOfTomorrow.getTime() + 24 * 60 * 60_000))
        groups[1].items.push(item);
      else if (ts < startOfWeekEnd) groups[2].items.push(item);
      else groups[3].items.push(item);
    } else {
      // Posts, slots, and past events (rare): treat as recent activity
      groups[3].items.push(item);
    }
  }

  return groups.filter((g) => g.items.length > 0);
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
          className="mt-4 inline-block rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
