import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import type { SocialLinks, Education } from "@/lib/auth";
import { getFollowStats, isFollowing } from "@/lib/follows";
import { listPublicSlotsByUsername } from "@/lib/slots";
import { getReactionsForMany } from "@/lib/reactions";
import { ReactionStrip } from "@/components/ReactionStrip";
import { getProfileWeek, startOfWeek } from "@/lib/profile-week";
import { WeekCalendar } from "@/components/WeekCalendar";
import { FollowButton } from "./FollowButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getProfile(params.username);
  if (!profile) return { title: "Not found" };
  const name = profile.display_name || profile.username;
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || `${name}'s orbit on Orbit42`,
  };
}

export default async function PublicProfile({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);

  const [session, stats, viewerFollowing, slots, weekDays] = await Promise.all([
    getSession(),
    getFollowStats(params.username),
    isFollowing(params.username),
    listPublicSlotsByUsername(params.username),
    getProfileWeek(params.username, weekStart, weekEnd),
  ]);
  const slotReactions = await getReactionsForMany(
    "slot",
    slots.map((s) => s.id),
  );

  const isOwner = session?.username === params.username;
  const socialLinks = (profile.social_links || {}) as SocialLinks;
  const education = ((profile.education || []) as Education[]).sort((a, b) => {
    const yearA = parseInt(a.startYear || "0") || 0;
    const yearB = parseInt(b.startYear || "0") || 0;
    return yearB - yearA;
  });
  const interests = (profile.interests || []) as string[];

  const totalSlotWindows = weekDays.reduce(
    (n, d) => n + d.items.filter((i) => i.kind === "slot").length,
    0,
  );

  return (
    <div className="space-y-8">
      {/* Identity row — compact */}
      <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-600/40 to-amber-500/30 text-2xl font-bold text-charcoal-100">
            {(profile.display_name || profile.username).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-charcoal-100 md:text-[28px]">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-sm text-charcoal-500">@{profile.username}</p>
            <div className="mt-2 flex gap-4 text-xs text-charcoal-400">
              <span>
                <strong className="text-charcoal-100">{stats.followers}</strong>{" "}
                <span className="text-charcoal-500">orbiters</span>
              </span>
              <span>
                <strong className="text-charcoal-100">{stats.following}</strong>{" "}
                <span className="text-charcoal-500">orbiting</span>
              </span>
              {totalSlotWindows > 0 && (
                <span>
                  <strong className="text-amber-300">{totalSlotWindows}</strong>{" "}
                  <span className="text-charcoal-500">예약가능</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isOwner ? (
            <>
              <Link
                href={`/${params.username}/slots`}
                className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-charcoal-950 hover:bg-amber-400"
              >
                Sell my time
              </Link>
              <Link
                href={`/${params.username}/settings`}
                className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm font-medium text-charcoal-200 hover:border-charcoal-600 hover:text-charcoal-100"
              >
                Edit
              </Link>
            </>
          ) : (
            <FollowButton
              targetUsername={params.username}
              initiallyFollowing={viewerFollowing}
              loggedIn={!!session}
            />
          )}
        </div>
      </header>

      {profile.bio && (
        <p className="max-w-2xl text-sm leading-relaxed text-charcoal-300">{profile.bio}</p>
      )}

      {interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {interests.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-navy-600/15 px-3 py-1 text-xs font-medium text-navy-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-3">
          <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
            Quick add
          </span>
          <ActionPill href="/feed" label="Share status" icon="💬" />
          <ActionPill href={`/${params.username}/slots`} label="Open slot" icon="🪙" highlight />
          <ActionPill href={`/${params.username}/calendar`} label="Add event" icon="🗓️" />
          <ActionPill
            href={`/${params.username}/settings`}
            label="Visibility"
            icon="🔓"
          />
        </div>
      )}

      {/* HERO: week calendar with events + bookable slots */}
      <WeekCalendar
        username={params.username}
        days={weekDays}
        emptyMessage={
          isOwner
            ? "이번 주가 비어있어요. Quick add에서 슬롯을 열거나 캘린더를 공개해보세요."
            : "이번 주에 공개된 일정이나 예약 가능한 시간이 없어요."
        }
      />

      <div className="flex items-center justify-end">
        <Link
          href={`/${params.username}/c`}
          className="text-xs font-medium text-charcoal-400 hover:text-charcoal-100"
        >
          See full calendar →
        </Link>
      </div>

      {slots.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-charcoal-100">All slots</h2>
            <span className="text-xs text-charcoal-500">{slots.length}개</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {slots.map((s) => (
              <div
                key={s.id}
                className="group rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 transition-colors hover:border-amber-500/50"
              >
                <Link href={`/${params.username}/s/${s.slug}`} className="block">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-charcoal-100 group-hover:text-amber-200">
                      {s.title}
                    </h3>
                    <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">
                      {s.price_cents === 0
                        ? "FREE"
                        : `₩${(s.price_cents / 100).toLocaleString("ko-KR")}`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-charcoal-500">
                    {s.duration_min}분 · {s.slot_type}
                    {s.location_detail && ` · ${s.location_detail}`}
                  </p>
                  {s.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-charcoal-400">
                      {s.description}
                    </p>
                  )}
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
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href={`/${params.username}/blog`}
          className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 hover:border-charcoal-700"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
            Posts
          </p>
          <p className="mt-1 text-sm text-charcoal-200">최근 글 둘러보기 →</p>
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
                className="rounded-lg border border-charcoal-800/60 bg-charcoal-800/20 px-3 py-1.5 text-xs font-medium text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
              >
                {k}
              </a>
            ))}
        </section>
      )}
    </div>
  );
}

function ActionPill({
  href,
  label,
  icon,
  highlight,
}: {
  href: string;
  label: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        highlight
          ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
          : "bg-charcoal-800/40 text-charcoal-300 hover:bg-charcoal-800/70 hover:text-charcoal-100"
      }`}
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}
