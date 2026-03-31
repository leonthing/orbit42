import Link from "next/link";
import type { Metadata } from "next";
import { getAdminClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Orbit42 Blog",
  description: "Orbit42에서 운영되는 블로그 플랫폼",
};

async function getBloggers() {
  const db = getAdminClient();

  const { data: posts } = await db
    .from("blog_posts")
    .select("user_id")
    .eq("published", true);

  if (!posts || posts.length === 0) return [];

  const userIds = [...new Set(posts.map((p: { user_id: string }) => p.user_id))];

  const { data: users } = await db
    .from("users")
    .select("username, display_name, bio")
    .in("id", userIds);

  return (users ?? []) as { username: string; display_name: string | null; bio: string | null }[];
}

export default async function BlogRootPage() {
  const bloggers = await getBloggers();

  return (
    <>
      <header className="mb-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-600/20">
          <span className="text-2xl font-bold text-navy-400">O</span>
        </div>
        <h1 className="text-3xl font-bold text-charcoal-100">Orbit42 Blog</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-400">
          기록하고, 정리하고, 공유하는 공간.<br />
          Orbit42 사용자들의 블로그를 만나보세요.
        </p>
      </header>

      {bloggers.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-charcoal-500">Writers</h2>
          <div className="divide-y divide-charcoal-800/40 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
            {bloggers.map((user) => (
              <Link
                key={user.username}
                href={`/${user.username}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-charcoal-800/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-charcoal-800 text-sm font-semibold text-charcoal-300">
                  {(user.display_name || user.username).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-charcoal-100">
                    {user.display_name || user.username}
                  </p>
                  {user.bio && (
                    <p className="mt-0.5 truncate text-sm text-charcoal-500">{user.bio}</p>
                  )}
                </div>
                <svg className="ml-auto h-4 w-4 shrink-0 text-charcoal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-charcoal-700 py-16">
          <p className="text-sm text-charcoal-500">아직 게시된 글이 없습니다.</p>
          <p className="mt-1 text-xs text-charcoal-600">
            <a href="https://orbit42.org" className="text-navy-400 hover:underline">Orbit42</a>에서 첫 글을 작성해보세요.
          </p>
        </div>
      )}
    </>
  );
}
