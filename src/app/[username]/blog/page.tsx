import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, getProfile } from "@/lib/auth";
import { getBlogPosts, getPublicPostsByUsername } from "./actions";
import BlogPostList from "./BlogPostList";
import { getReactionsForMany } from "@/lib/reactions";
import { ReactionStrip } from "@/components/ReactionStrip";

export const metadata: Metadata = { title: "글" };
export const dynamic = "force-dynamic";

export default async function BlogPage({
  params,
}: {
  params: { username: string };
}) {
  const session = await getSession();
  const isOwner = session?.username === params.username;

  if (isOwner) {
    const posts = await getBlogPosts();
    return <BlogPostList initialPosts={posts} />;
  }

  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const posts = await getPublicPostsByUsername(params.username);
  const reactions = await getReactionsForMany(
    "post",
    posts.map((p) => p.id),
  );

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/${params.username}`}
          className="text-xs text-charcoal-500 hover:text-charcoal-300"
        >
          ← {profile.display_name || profile.username}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-charcoal-100">Posts</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          {posts.length === 0 ? "아직 글이 없어요." : `${posts.length}개의 글`}
        </p>
      </header>

      <ul className="space-y-3">
        {posts.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5"
          >
            <Link href={`/${params.username}/blog/${p.slug}`} className="block group">
              <p className="text-xs text-charcoal-500">
                {p.published_at &&
                  new Date(p.published_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-charcoal-100 group-hover:text-red-300">
                {p.title || "(제목 없음)"}
              </h2>
              {p.excerpt && (
                <p className="mt-2 line-clamp-2 text-sm text-charcoal-400">{p.excerpt}</p>
              )}
            </Link>
            <div className="mt-3">
              <ReactionStrip
                target_type="post"
                target_id={p.id}
                initial={reactions.get(p.id) ?? []}
                loggedIn={!!session}
                size="sm"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
