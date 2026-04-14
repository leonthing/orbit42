import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { listFollowing } from "@/lib/follows";
import { getReactionsForMany } from "@/lib/reactions";
import { ReactionStrip } from "@/components/ReactionStrip";

export const metadata: Metadata = { title: "Explore" };
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const session = await getSession();

  const followingUsernames = session
    ? new Set((await listFollowing(session.username)).map((u) => u.username))
    : new Set<string>();

  const db = getAdminClient();
  const recentSince = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();

  // Active people: anyone who posted or opened a slot in the last 30 days,
  // plus the most recently joined users as a fallback.
  const [recentPostUsers, recentSlotUsers, latestUsers, openSlots] = await Promise.all([
    db
      .from("blog_posts")
      .select("user_id, published_at, user:users!blog_posts_user_id_fkey(username, display_name, bio)")
      .eq("published", true)
      .gte("published_at", recentSince)
      .order("published_at", { ascending: false })
      .limit(30),
    db
      .from("time_slots")
      .select("host_id, created_at, host:users!time_slots_host_id_fkey(username, display_name, bio)")
      .eq("active", true)
      .gte("created_at", recentSince)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("users")
      .select("username, display_name, bio, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("time_slots")
      .select(
        "id, slug, title, duration_min, price_cents, slot_type, location_detail, created_at, host:users!time_slots_host_id_fkey(username, display_name)",
      )
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  // Aggregate active users
  type ActiveUser = {
    username: string;
    display_name: string | null;
    bio: string | null;
    last_active: string;
    activity: "글" | "슬롯" | "신규";
  };
  const peopleMap = new Map<string, ActiveUser>();

  for (const p of recentPostUsers.data ?? []) {
    const u = p.user as unknown as { username: string; display_name: string | null; bio: string | null };
    if (!u || !u.username) continue;
    if (session && u.username === session.username) continue;
    if (!peopleMap.has(u.username)) {
      peopleMap.set(u.username, {
        username: u.username,
        display_name: u.display_name,
        bio: u.bio,
        last_active: p.published_at as string,
        activity: "글",
      });
    }
  }
  for (const s of recentSlotUsers.data ?? []) {
    const u = s.host as unknown as { username: string; display_name: string | null; bio: string | null };
    if (!u || !u.username) continue;
    if (session && u.username === session.username) continue;
    if (!peopleMap.has(u.username)) {
      peopleMap.set(u.username, {
        username: u.username,
        display_name: u.display_name,
        bio: u.bio,
        last_active: s.created_at as string,
        activity: "슬롯",
      });
    }
  }
  for (const u of latestUsers.data ?? []) {
    if (session && u.username === session.username) continue;
    if (!peopleMap.has(u.username as string)) {
      peopleMap.set(u.username as string, {
        username: u.username as string,
        display_name: (u.display_name as string | null) ?? null,
        bio: (u.bio as string | null) ?? null,
        last_active: u.created_at as string,
        activity: "신규",
      });
    }
  }

  const activePeople = Array.from(peopleMap.values()).sort(
    (a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime(),
  );

  const slots = (openSlots.data ?? []).map((s) => ({
    id: s.id as string,
    slug: s.slug as string,
    title: s.title as string,
    duration_min: s.duration_min as number,
    price_cents: s.price_cents as number,
    slot_type: s.slot_type as string,
    location_detail: (s.location_detail as string | null) ?? null,
    host: s.host as unknown as { username: string; display_name: string | null },
  }));

  const slotReactions = await getReactionsForMany(
    "slot",
    slots.map((s) => s.id),
  );

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-charcoal-100">Explore</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          새로운 궤도를 발견해보세요.
        </p>
      </header>

      <section className="mb-10">
        <SectionTitle title="People you might orbit" hint="최근 활동한 사람들" />
        {activePeople.length === 0 ? (
          <EmptyHint body="아직 활동한 사람이 없어요." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activePeople.slice(0, 12).map((p) => (
              <PersonCard
                key={p.username}
                username={p.username}
                displayName={p.display_name}
                bio={p.bio}
                badge={p.activity}
                isFollowing={followingUsernames.has(p.username)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="Open slots" hint="지금 열려 있는 시간들" />
        {slots.length === 0 ? (
          <EmptyHint body="열린 슬롯이 아직 없어요." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {slots.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5"
              >
                <div className="flex items-center gap-2 text-xs text-charcoal-500">
                  <Link
                    href={`/${s.host.username}`}
                    className="font-medium text-charcoal-300 hover:text-charcoal-100"
                  >
                    {s.host.display_name || s.host.username}
                  </Link>
                  <span>·</span>
                  <span>@{s.host.username}</span>
                </div>
                <Link
                  href={`/${s.host.username}/s/${s.slug}`}
                  className="mt-2 block"
                >
                  <p className="text-sm font-semibold text-charcoal-100 hover:text-red-300">
                    {s.title}
                  </p>
                  <p className="mt-1 text-xs text-charcoal-500">
                    {s.duration_min}분 · {s.slot_type}{" "}
                    {s.location_detail && `· ${s.location_detail}`}{" "}
                    ·{" "}
                    {s.price_cents === 0
                      ? "Free"
                      : `${(s.price_cents / 100).toLocaleString("ko-KR")}원`}
                  </p>
                </Link>
                <div className="mt-3">
                  <ReactionStrip
                    target_type="slot"
                    target_id={s.id}
                    initial={slotReactions.get(s.id) ?? []}
                    loggedIn={!!session}
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-base font-semibold text-charcoal-100">{title}</h2>
      {hint && <span className="text-xs text-charcoal-500">{hint}</span>}
    </div>
  );
}

function EmptyHint({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-charcoal-800/60 p-6 text-center text-sm text-charcoal-500">
      {body}
    </div>
  );
}

function PersonCard({
  username,
  displayName,
  bio,
  badge,
  isFollowing,
}: {
  username: string;
  displayName: string | null;
  bio: string | null;
  badge: string;
  isFollowing: boolean;
}) {
  return (
    <Link
      href={`/${username}`}
      className="group block rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 transition-colors hover:border-red-500/60"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-base font-bold text-red-400">
          {(displayName || username).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-charcoal-100 group-hover:text-red-300">
              {displayName || username}
            </p>
            {isFollowing && (
              <span className="rounded-full bg-red-600/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-300">
                ORBITING
              </span>
            )}
          </div>
          <p className="text-xs text-charcoal-500">@{username}</p>
          {bio && (
            <p className="mt-2 line-clamp-2 text-xs text-charcoal-400">{bio}</p>
          )}
          <span className="mt-2 inline-block rounded-full bg-charcoal-800/60 px-2 py-0.5 text-[10px] font-semibold text-charcoal-400">
            {badge}
          </span>
        </div>
      </div>
    </Link>
  );
}
