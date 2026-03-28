import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import type { SocialLinks, Education } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const SOCIAL_CONFIG: { key: keyof SocialLinks; label: string; color: string; icon: React.ReactNode }[] = [
  {
    key: "instagram",
    label: "Instagram",
    color: "from-purple-500 to-pink-500",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    key: "x",
    label: "X",
    color: "from-gray-600 to-gray-800",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "youtube",
    label: "YouTube",
    color: "from-red-600 to-red-700",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    key: "facebook",
    label: "Facebook",
    color: "from-blue-600 to-blue-700",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    color: "from-blue-500 to-blue-600",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

export default async function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const socialLinks = (profile.social_links || {}) as SocialLinks;
  const activeSocials = SOCIAL_CONFIG.filter((s) => socialLinks[s.key]);
  const education = ((profile.education || []) as Education[]).sort((a, b) => {
    const yearA = parseInt(a.startYear || "0") || 0;
    const yearB = parseInt(b.startYear || "0") || 0;
    return yearA - yearB;
  });
  const interests = (profile.interests || []) as string[];

  const age = profile.birth_date
    ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Profile</h1>
        <p className="mt-1 text-sm text-charcoal-500">내 프로필</p>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Profile Card */}
        <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy-600/20 text-2xl font-bold text-navy-400">
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-charcoal-100">
                {profile.display_name || profile.username}
              </h2>
              <p className="text-sm text-charcoal-500">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-1 text-sm text-charcoal-400">{profile.bio}</p>
              )}
            </div>
          </div>

          {interests.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {profile.birth_date && (
              <div className="rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 px-4 py-3">
                <p className="text-xs font-medium text-charcoal-500">생년월일</p>
                <p className="mt-1 text-sm text-charcoal-200">
                  {new Date(profile.birth_date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                  {age !== null && <span className="ml-1 text-charcoal-500">({age}세)</span>}
                </p>
              </div>
            )}
            <div className="rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 px-4 py-3">
              <p className="text-xs font-medium text-charcoal-500">가입일</p>
              <p className="mt-1 text-sm text-charcoal-200">
                {new Date(profile.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </section>

        {/* Education */}
        {education.length > 0 && (
          <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
            <div className="border-b border-charcoal-800/40 px-5 py-3">
              <h2 className="text-sm font-semibold text-charcoal-200">학력</h2>
            </div>
            <div className="space-y-3 p-5">
              {education.map((edu, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-charcoal-800/50 text-charcoal-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                      </svg>
                    </div>
                    {i < education.length - 1 && (
                      <div className="mt-1 flex-1 border-l border-charcoal-800/40" />
                    )}
                  </div>
                  <div className="pb-4">
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

        {/* Social Links */}
        {activeSocials.length > 0 && (
          <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
            <div className="border-b border-charcoal-800/40 px-5 py-3">
              <h2 className="text-sm font-semibold text-charcoal-200">SNS</h2>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {activeSocials.map((social) => (
                <a
                  key={social.key}
                  href={socialLinks[social.key]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 px-4 py-3 transition-colors hover:border-charcoal-700 hover:bg-charcoal-800/40"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${social.color} text-white`}>
                    {social.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal-200">{social.label}</p>
                    <p className="truncate text-xs text-charcoal-500">
                      {socialLinks[social.key]!.replace(/^https?:\/\/(www\.)?/, "")}
                    </p>
                  </div>
                  <svg className="ml-auto h-4 w-4 shrink-0 text-charcoal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
