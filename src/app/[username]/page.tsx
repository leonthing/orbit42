import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import type { SocialLinks, Education, Experience } from "@/lib/auth";
import { getFollowStats, isFollowing } from "@/lib/follows";
import { listPublicSlotsByUsername } from "@/lib/slots";
import { getReactionsForMany } from "@/lib/reactions";
import { SlotPanelProvider } from "@/components/SlotPanel";
import { AllSlotsGrid } from "@/components/AllSlotsGrid";
import { getValueStats } from "@/lib/value-stats";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "./FollowButton";
import { listFeedPostsByAuthors } from "@/lib/feed-posts";
import { getAdminClient } from "@/lib/supabase";
import { DeleteFeedPostButton } from "@/components/DeleteFeedPostButton";
import { ReactionStrip } from "@/components/ReactionStrip";
import Image from "next/image";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getProfile(params.username);
  if (!profile) return { title: "Not found" };
  const name = profile.display_name || profile.username;
  const title = `${name} (@${profile.username})`;
  const description = profile.bio || `${name}'s orbit on Orbit42`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "Orbit42",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicProfile({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const [session, stats, viewerFollowing, slots, value] = await Promise.all([
    getSession(),
    getFollowStats(params.username),
    isFollowing(params.username),
    listPublicSlotsByUsername(params.username),
    getValueStats(params.username),
  ]);
  const slotReactions = await getReactionsForMany(
    "slot",
    slots.map((s) => s.id),
  );

  const db = getAdminClient();
  const { data: userRow } = await db
    .from("users")
    .select("id")
    .eq("username", params.username)
    .single();
  const authorId = (userRow?.id as string | undefined) ?? null;
  const myFeedPosts = authorId
    ? await listFeedPostsByAuthors([authorId], 20)
    : [];
  const feedPostReactions = await getReactionsForMany(
    "feed_post",
    myFeedPosts.map((p) => p.id),
  );

  const isOwner = session?.username === params.username;
  const socialLinks = (profile.social_links || {}) as SocialLinks;
  const education = ((profile.education || []) as Education[]).sort((a, b) => {
    const yearA = parseInt(a.startYear || "0") || 0;
    const yearB = parseInt(b.startYear || "0") || 0;
    return yearB - yearA;
  });
  const experience = ((profile.experience || []) as Experience[]).sort((a, b) => {
    // Current roles first, then by startYear desc.
    if (a.current && !b.current) return -1;
    if (!a.current && b.current) return 1;
    const yearA = parseInt(a.startYear || "0") || 0;
    const yearB = parseInt(b.startYear || "0") || 0;
    return yearB - yearA;
  });
  const interests = (profile.interests || []) as string[];
  const totalSlotWindows = slots.length;

  return (
    <div className="space-y-8">
      {/* Identity row — compact */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <Avatar
            url={(profile.avatar_url as string | null) ?? null}
            name={profile.display_name || profile.username}
            size={56}
            className="sm:!h-[72px] sm:!w-[72px]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="min-w-0 break-words text-xl font-bold leading-tight text-charcoal-100 sm:text-2xl md:text-[28px]">
                {profile.display_name || profile.username}
              </h1>
              {!isOwner && (
                <FollowButton
                  targetUsername={params.username}
                  initiallyFollowing={viewerFollowing}
                  loggedIn={!!session}
                />
              )}
            </div>
            <p className="truncate text-sm text-charcoal-500">
              @{profile.username}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal-400">
              <Link
                href={`/${params.username}/followers`}
                className="hover:text-charcoal-200"
              >
                <strong className="text-charcoal-100">{stats.followers}</strong>{" "}
                <span className="text-charcoal-500">orbiters</span>
              </Link>
              <Link
                href={`/${params.username}/following`}
                className="hover:text-charcoal-200"
              >
                <strong className="text-charcoal-100">{stats.following}</strong>{" "}
                <span className="text-charcoal-500">orbiting</span>
              </Link>
              {totalSlotWindows > 0 && (
                <span>
                  <strong className="text-red-700 dark:text-red-300">{totalSlotWindows}</strong>{" "}
                  <span className="text-charcoal-500">예약가능</span>
                </span>
              )}
            </div>
          </div>
        </div>
        {isOwner && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={`/${params.username}/slots`}
              className="flex-1 whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:flex-none"
            >
              Sell my time
            </Link>
            <Link
              href={`/${params.username}/settings`}
              className="flex-1 whitespace-nowrap rounded-lg border border-charcoal-700 bg-charcoal-900/30 px-4 py-2 text-center text-sm font-medium text-charcoal-100 hover:border-charcoal-600 hover:bg-charcoal-900/60 sm:flex-none"
            >
              Edit
            </Link>
          </div>
        )}
      </header>

      {Object.values(socialLinks).some(Boolean) && (
        <section className="flex flex-wrap gap-2">
          {Object.entries(socialLinks)
            .filter(([, v]) => !!v)
            .map(([k, v]) => (
              <a
                key={k}
                href={v as string}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-charcoal-800/60 bg-charcoal-800/20 px-3 py-1.5 text-xs font-medium text-charcoal-700 hover:border-charcoal-600 hover:text-charcoal-900 dark:text-charcoal-300 dark:hover:text-charcoal-100"
              >
                {k}
              </a>
            ))}
        </section>
      )}

      {profile.bio && (
        <p className="max-w-2xl text-sm leading-relaxed text-charcoal-300">{profile.bio}</p>
      )}

      {isOwner && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ValueStat
            label="누적 거래"
            value={`${value.total_bookings + (value.highest_bid_cents ? 1 : 0)}`}
          />
          <ValueStat
            label="누적 가치"
            value={`₩${(value.total_revenue_cents / 100).toLocaleString("ko-KR")}`}
            accent
          />
          <ValueStat
            label="평균 단가"
            value={
              value.average_price_cents > 0
                ? `₩${(value.average_price_cents / 100).toLocaleString("ko-KR")}`
                : "—"
            }
          />
          <ValueStat
            label="최고 낙찰"
            value={
              value.highest_bid_cents
                ? `₩${(value.highest_bid_cents / 100).toLocaleString("ko-KR")}`
                : "—"
            }
          />
        </div>
      )}

      {interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {interests.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-800 ring-1 ring-red-500/30 dark:text-red-200 dark:ring-0"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-3">
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 px-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
              Quick add
            </span>
            <ActionPill href="/feed" label="Share status" />
            <ActionPill href={`/${params.username}/slots`} label="Open slot" highlight />
            <ActionPill href={`/${params.username}/calendar`} label="Add event" />
            <ActionPill href={`/${params.username}/book`} label="Share booking link" />
            <ActionPill href={`/${params.username}/settings`} label="Visibility" />
          </div>
        </div>
      )}

      {!isOwner && totalSlotWindows > 0 && (
        <div className="flex justify-end">
          <Link
            href={`/${params.username}/calendar`}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-charcoal-950 hover:bg-red-400"
          >
            예약하기 ({totalSlotWindows})
          </Link>
        </div>
      )}

      {slots.length > 0 && (
        <SlotPanelProvider username={params.username}>
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-charcoal-100">All slots</h2>
              <span className="text-xs text-charcoal-500">{slots.length}개</span>
            </div>
            <AllSlotsGrid
              username={params.username}
              slots={slots.map((s) => ({
                id: s.id,
                slug: s.slug,
                title: s.title,
                price_cents: s.price_cents,
                duration_min: s.duration_min,
                slot_type: s.slot_type,
                location_detail: s.location_detail,
                description: s.description,
                pricing_model: s.pricing_model,
                reserve_price_cents: s.reserve_price_cents,
                current_high_bid_cents: s.current_high_bid_cents,
                auction_ends_at: s.auction_ends_at,
              }))}
              reactionsBySlot={Array.from(slotReactions.entries())}
              loggedIn={!!session}
            />
          </section>
        </SlotPanelProvider>
      )}

      {myFeedPosts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-charcoal-100">
              내가 쓴 글
            </h2>
            <span className="text-xs text-charcoal-500">
              {myFeedPosts.length}
            </span>
          </div>
          <ul className="space-y-2.5">
            {myFeedPosts.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <time className="text-[11px] font-medium text-charcoal-500">
                    {new Date(p.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {isOwner && (
                    <DeleteFeedPostButton id={p.id} />
                  )}
                </div>
                {p.body && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-charcoal-100">
                    {p.body}
                  </p>
                )}
                {p.image_urls.length > 0 && (
                  <div
                    className={`mt-3 grid gap-2 ${
                      p.image_urls.length === 1
                        ? "grid-cols-1"
                        : p.image_urls.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-2 sm:grid-cols-3"
                    }`}
                  >
                    {p.image_urls.map((url) => (
                      <div
                        key={url}
                        className="relative aspect-video overflow-hidden rounded-lg bg-charcoal-800/40"
                      >
                        <Image
                          src={url}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 50vw, 300px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                )}
                {p.location_label && (
                  <p className="mt-2 text-xs text-charcoal-500">
                    📍 {p.location_label}
                  </p>
                )}
                <div className="mt-3">
                  <ReactionStrip
                    target_type="feed_post"
                    target_id={p.id}
                    initial={feedPostReactions.get(p.id) ?? []}
                    loggedIn={!!session}
                    size="sm"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href={`/${params.username}/blog`}
          className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 hover:border-charcoal-700"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
            긴 글
          </p>
          <p className="mt-1 text-sm text-charcoal-200">블로그 둘러보기 →</p>
        </Link>
        <Link
          href={`/${params.username}/c`}
          className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 hover:border-charcoal-700"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
            Calendar
          </p>
          <p className="mt-1 text-sm text-charcoal-200">월별 캘린더 보기 →</p>
        </Link>
      </div>

      {experience.length > 0 && (
        <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
          <div className="border-b border-charcoal-800/40 px-5 py-3">
            <h2 className="text-sm font-semibold text-charcoal-200">경력</h2>
          </div>
          <div className="space-y-3 p-5">
            {experience.map((exp, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-charcoal-800/50 text-charcoal-400">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z"
                      />
                    </svg>
                  </div>
                  {i < experience.length - 1 && (
                    <div className="mt-1 flex-1 border-l border-charcoal-800/40" />
                  )}
                </div>
                <div className="pb-2">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="font-medium text-charcoal-100">{exp.company}</p>
                    {exp.current && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/40 dark:text-emerald-200 dark:ring-0">
                        재직 중
                      </span>
                    )}
                  </div>
                  {exp.role && (
                    <p className="mt-0.5 text-sm text-charcoal-400">{exp.role}</p>
                  )}
                  {(exp.startYear || exp.endYear) && (
                    <p className="mt-0.5 text-xs text-charcoal-600">
                      {exp.startYear || "?"} — {exp.current ? "현재" : exp.endYear || "?"}
                    </p>
                  )}
                  {exp.description && (
                    <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-charcoal-400">
                      {exp.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {education.length > 0 && (
        <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
          <div className="border-b border-charcoal-800/40 px-5 py-3">
            <h2 className="text-sm font-semibold text-charcoal-200">학력</h2>
          </div>
          <div className="space-y-3 p-5">
            {education.map((edu, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-charcoal-800/50 text-charcoal-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                    </svg>
                  </div>
                  {i < education.length - 1 && (
                    <div className="mt-1 flex-1 border-l border-charcoal-800/40" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="font-medium text-charcoal-100">{edu.school}</p>
                  {(edu.degree || edu.field) && (
                    <p className="mt-0.5 text-sm text-charcoal-400">
                      {[edu.degree, edu.field].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {(edu.startYear || edu.endYear) && (
                    <p className="mt-0.5 text-xs text-charcoal-600">
                      {edu.startYear || "?"} — {edu.endYear || "현재"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

function ValueStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold ${
          accent ? "text-red-700 dark:text-red-300" : "text-charcoal-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ActionPill({
  href,
  label,
  highlight,
}: {
  href: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        highlight
          ? "bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-300"
          : "bg-charcoal-800/40 text-charcoal-700 hover:bg-charcoal-800/70 hover:text-charcoal-100 dark:text-charcoal-300"
      }`}
    >
      {label}
    </Link>
  );
}
