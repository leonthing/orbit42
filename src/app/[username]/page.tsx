import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import type { SocialLinks, Education } from "@/lib/auth";
import { getFollowStats, isFollowing } from "@/lib/follows";
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

  const [session, stats, viewerFollowing] = await Promise.all([
    getSession(),
    getFollowStats(params.username),
    isFollowing(params.username),
  ]);

  const isOwner = session?.username === params.username;
  const socialLinks = (profile.social_links || {}) as SocialLinks;
  const education = ((profile.education || []) as Education[]).sort((a, b) => {
    const yearA = parseInt(a.startYear || "0") || 0;
    const yearB = parseInt(b.startYear || "0") || 0;
    return yearB - yearA;
  });
  const interests = (profile.interests || []) as string[];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-navy-600/20 text-3xl font-bold text-navy-400">
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-charcoal-100 md:text-3xl">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-sm text-charcoal-500">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-3 max-w-xl text-sm text-charcoal-300">{profile.bio}</p>
              )}
              <div className="mt-4 flex gap-5 text-sm text-charcoal-400">
                <span>
                  <strong className="text-charcoal-100">{stats.followers}</strong>{" "}
                  <span className="text-charcoal-500">orbiters</span>
                </span>
                <span>
                  <strong className="text-charcoal-100">{stats.following}</strong>{" "}
                  <span className="text-charcoal-500">orbiting</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isOwner ? (
              <Link
                href={`/${params.username}/settings`}
                className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm font-medium text-charcoal-200 hover:border-charcoal-600 hover:text-charcoal-100"
              >
                Edit profile
              </Link>
            ) : (
              <FollowButton
                targetUsername={params.username}
                initiallyFollowing={viewerFollowing}
                loggedIn={!!session}
              />
            )}
          </div>
        </div>

        {interests.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {interests.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-navy-600/15 px-3 py-1 text-xs font-medium text-navy-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <SectionCard title="Calendar">
          <p className="text-sm text-charcoal-400">
            공개된 일정을 캘린더 뷰에서 볼 수 있어요.
          </p>
          <p className="mt-2 text-xs text-charcoal-600">
            (공개 캘린더 뷰는 곧 추가됩니다.)
          </p>
        </SectionCard>

        <SectionCard title="Slots">
          <p className="text-sm text-charcoal-400">
            예약 가능한 시간을 둘러보고 미팅을 잡아보세요.
          </p>
          <p className="mt-2 text-xs text-charcoal-600">
            (슬롯은 곧 추가됩니다.)
          </p>
        </SectionCard>

        <SectionCard title="Posts" cta="Read posts →" href={`/${params.username}/blog`}>
          <p className="text-sm text-charcoal-400">최근에 쓴 글을 모아봤어요.</p>
        </SectionCard>
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
        <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
          <div className="border-b border-charcoal-800/40 px-5 py-3">
            <h2 className="text-sm font-semibold text-charcoal-200">SNS</h2>
          </div>
          <div className="flex flex-wrap gap-2 p-5">
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
          </div>
        </section>
      )}
    </div>
  );
}

function SectionCard({
  title,
  cta,
  href,
  children,
}: {
  title: string;
  cta?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <h3 className="text-sm font-semibold text-charcoal-100">{title}</h3>
      <div className="mt-2 flex-1">{children}</div>
      {cta && href && (
        <Link
          href={href}
          className="mt-4 text-xs font-medium text-navy-400 hover:text-navy-300"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}
