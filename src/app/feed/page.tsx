import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { listFollowing } from "@/lib/follows";
import { PublicChrome } from "@/components/layout/PublicChrome";

export const metadata: Metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

type FeedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  author: { username: string; display_name: string | null };
};

export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const following = await listFollowing(session.username);
  const followingIds = following.map((u) => u.id);

  let posts: FeedPost[] = [];
  if (followingIds.length > 0) {
    const db = getAdminClient();
    const { data } = await db
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, published_at, user:users!blog_posts_user_id_fkey(username, display_name)",
      )
      .eq("published", true)
      .in("user_id", followingIds)
      .order("published_at", { ascending: false })
      .limit(30);

    posts = (data ?? []).map((p) => ({
      id: p.id as string,
      slug: p.slug as string,
      title: p.title as string,
      excerpt: (p.excerpt as string | null) ?? null,
      published_at: (p.published_at as string | null) ?? null,
      author: p.user as unknown as { username: string; display_name: string | null },
    }));
  }

  return (
    <PublicChrome viewerUsername={session.username}>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-charcoal-100">Feed</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            팔로우 중인 사람들의 최근 글
          </p>
        </header>

        {following.length === 0 ? (
          <EmptyState
            title="아직 궤도가 비어있어요"
            body="관심 있는 사람을 팔로우(Orbit)하면 그들의 글과 일정이 여기에 모입니다."
          />
        ) : posts.length === 0 ? (
          <EmptyState
            title="새 글이 없어요"
            body="팔로우 중인 사람들이 글을 올리면 알려드릴게요."
          />
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li
                key={post.id}
                className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5"
              >
                <Link
                  href={`/${post.author.username}/blog/${post.slug}`}
                  className="block group"
                >
                  <div className="flex items-center gap-2 text-xs text-charcoal-500">
                    <span className="font-medium text-charcoal-300">
                      {post.author.display_name || post.author.username}
                    </span>
                    <span>·</span>
                    <span>@{post.author.username}</span>
                    {post.published_at && (
                      <>
                        <span>·</span>
                        <time>
                          {new Date(post.published_at).toLocaleDateString("ko-KR", {
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      </>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-charcoal-100 group-hover:text-navy-300">
                    {post.title || "(제목 없음)"}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-2 line-clamp-2 text-sm text-charcoal-400">
                      {post.excerpt}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {following.length > 0 && (
          <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
            <h3 className="text-sm font-semibold text-charcoal-200">
              Orbiting ({following.length})
            </h3>
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
        )}
      </div>
    </PublicChrome>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-charcoal-800/60 p-10 text-center">
      <p className="text-sm font-semibold text-charcoal-200">{title}</p>
      <p className="mt-2 text-sm text-charcoal-500">{body}</p>
    </div>
  );
}
