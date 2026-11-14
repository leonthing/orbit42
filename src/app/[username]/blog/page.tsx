import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, getProfile } from "@/lib/auth";
import { getBlogPosts, getPublicPostsByUsername } from "./actions";
import BlogPostList from "./BlogPostList";
import { getReactionsForMany } from "@/lib/reactions";
import { ReactionStrip } from "@/components/ReactionStrip";
import { getAdminClient } from "@/lib/supabase";
import { listPostsForWeb } from "@/lib/posts";
import { postsOpenFor } from "@/lib/posts-access";
import { PhotoPostGrid, toGridPost } from "@/components/posts/PhotoPostGrid";

async function idOf(username: string | null | undefined): Promise<string | null> {
  if (!username) return null;
  const { data } = await getAdminClient().from("users").select("id").eq("username", username).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** 글·사진 칸(1.10.0) — 볼 수 없으면(시험 기간 허용 목록 밖) 아무것도 그리지 않는다 */
function PhotoSection({ username, posts, isOwner, canWrite }: { username: string; posts: Awaited<ReturnType<typeof listPostsForWeb>>; isOwner: boolean; canWrite: boolean }) {
  if (!isOwner && posts.length === 0) return null;
  if (isOwner && !canWrite) return null;
  return (
    <section className="max-w-3xl space-y-3" aria-labelledby="photo-posts-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="photo-posts-title" className="text-lg font-semibold text-charcoal-100">
          글·사진 <span className="text-sm font-normal text-charcoal-500">{posts.length > 0 ? `${posts.length}개` : ""}</span>
        </h2>
        {isOwner && (
          <Link
            href={`/${username}/blog/photo/new`}
            className="inline-flex min-h-11 items-center rounded-lg bg-navy-500 px-4 text-sm font-semibold text-white hover:bg-navy-400"
          >
            새 글
          </Link>
        )}
      </div>
      {posts.length > 0 ? (
        <PhotoPostGrid username={username} posts={posts.map(toGridPost)} />
      ) : (
        <p className="rounded-xl border border-dashed border-charcoal-800/60 px-4 py-8 text-center text-sm text-charcoal-400">
          작업 사진이나 소식을 올리면 링크 페이지를 찾은 분들이 볼 수 있어요.
        </p>
      )}
    </section>
  );
}

export const metadata: Metadata = { title: "글" };
export const dynamic = "force-dynamic";

export default async function BlogPage({
  params,
}: {
  params: { username: string };
}) {
  const session = await getSession();
  const isOwner = session?.username === params.username;

  const viewerId = await idOf(session?.username);
  if (isOwner) {
    const [posts, photoPosts] = await Promise.all([getBlogPosts(), viewerId ? listPostsForWeb(viewerId, viewerId, 60) : Promise.resolve([])]);
    return (
      <div className="space-y-8">
        <PhotoSection username={params.username} posts={photoPosts} isOwner canWrite={postsOpenFor(viewerId)} />
        {/* 옛 마크다운 글: 글·사진을 쓸 수 있는 계정은 옛 글이 있을 때만 목록을 보인다('새 글' 버튼이 두 개가 되지 않게) */}
        {(!postsOpenFor(viewerId) || posts.length > 0) && <BlogPostList initialPosts={posts} />}
      </div>
    );
  }

  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const authorId = await idOf(params.username);
  const [posts, photoPosts] = await Promise.all([
    getPublicPostsByUsername(params.username),
    authorId ? listPostsForWeb(viewerId, authorId, 60) : Promise.resolve([]),
  ]);
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

      <PhotoSection username={params.username} posts={photoPosts} isOwner={false} canWrite={false} />

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
              <h2 className="mt-1 text-lg font-semibold text-charcoal-100 group-hover:text-navy-300">
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
