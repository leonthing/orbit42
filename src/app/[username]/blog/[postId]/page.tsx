import { PostBody } from "@/components/posts/PostBody";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublicPostBySlug } from "../actions";
import { resolveRenamedSlug } from "@/app/blog-public/actions";
import { getSession } from "@/lib/auth";
import { getReactionsFor } from "@/lib/reactions";
import { ReactionStrip } from "@/components/ReactionStrip";
import { CommentSection } from "@/components/CommentSection";
import { getAdminClient } from "@/lib/supabase";
import { getPostForWeb } from "@/lib/posts";
import { postsOpenFor, postsPublic } from "@/lib/posts-access";
import { PhotoPostView } from "@/components/posts/PhotoPostView";

async function viewerIdOf(username: string | null | undefined): Promise<string | null> {
  if (!username) return null;
  const { data } = await getAdminClient().from("users").select("id").eq("username", username).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** 앱 글·사진(1.10.0) — 공개 스위치가 꺼져 있으면 허용 목록 계정(과 본인)에게만, 아니면 null(→ 404) */
async function appPost(username: string, slug: string) {
  const session = await getSession();
  const viewerId = await viewerIdOf(session?.username);
  const post = await getPostForWeb(viewerId, username, decodeURIComponent(slug));
  return post ? { post, viewerId, loggedIn: !!session } : null;
}

export const dynamic = "force-dynamic";

// `postId` here is treated as the slug, since public links from feed/profile
// use slugs. The owner's edit page (under /[postId]/edit) still uses the UUID.
export async function generateMetadata({
  params,
}: {
  params: { username: string; postId: string };
}): Promise<Metadata> {
  const data = await getPublicPostBySlug(params.username, params.postId);
  if (!data) {
    const a = await appPost(params.username, params.postId);
    if (!a) return { title: "찾을 수 없음" };
    const name = a.post.author.displayName || a.post.author.username;
    return {
      title: a.post.title || `${name}님의 사진`,
      description: a.post.body.replace(/[#>*_~`]/g, "").replace(/\s+/g, " ").slice(0, 120) || undefined,
      // 공개 스위치 전에는 검색에 안 잡히게
      robots: postsPublic() && a.post.visibility === "public" ? undefined : { index: false, follow: false },
      openGraph:
        postsPublic() && a.post.visibility === "public"
          ? { images: [{ url: `/api/og/post/${encodeURIComponent(params.username)}/${encodeURIComponent(decodeURIComponent(params.postId))}`, width: 1200, height: 630 }] }
          : undefined,
    };
  }
  return {
    title: data.post.title,
    description: data.post.excerpt ?? undefined,
  };
}

export default async function PublicPostPage({
  params,
}: {
  params: { username: string; postId: string };
}) {
  const data = await getPublicPostBySlug(params.username, params.postId);
  if (!data) {
    const a = await appPost(params.username, params.postId);
    if (a) {
      const p = a.post;
      return (
        <PhotoPostView
          publicOpen={postsPublic()}
          loggedIn={a.loggedIn}
          isOwner={p.mine}
          post={{
            id: p.id,
            slug: params.postId,
            title: p.title,
            body: p.body,
            isPublic: p.visibility === "public",
            hidden: p.hidden,
            photos: p.photos.map((ph) => ({ id: ph.id, url: ph.url, width: ph.width, height: ph.height, caption: ph.caption })),
            likeCount: p.likeCount,
            liked: p.liked,
            createdAt: p.publishedAt ?? p.createdAt,
            editedAt: p.editedAt,
            pinned: p.pinned,
            url: p.url,
            bookingUrl: p.bookingUrl ?? null,
            author: { username: p.author.username, displayName: p.author.displayName },
          }}
        />
      );
    }
    const currentSlug = await resolveRenamedSlug(params.username, params.postId);
    if (currentSlug) {
      permanentRedirect(
        `/${params.username}/blog/${encodeURIComponent(currentSlug)}`,
      );
    }
    notFound();
  }
  const { post, author, isOwner } = data;

  const [session, reactions] = await Promise.all([
    getSession(),
    getReactionsFor("post", post.id),
  ]);

  let viewerId: string | null = null;
  if (session) {
    const { data: viewer } = await getAdminClient()
      .from("users")
      .select("id")
      .eq("username", session.username)
      .single();
    viewerId = (viewer?.id as string | undefined) ?? null;
  }

  return (
    <article className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={
            isOwner
              ? `/${author.username}/blog`
              : `/${author.username}`
          }
          className="inline-flex items-center gap-1 text-xs text-charcoal-400 hover:text-charcoal-100 max-md:-ml-2 max-md:min-h-11 max-md:px-2"
        >
          ← {isOwner ? (postsOpenFor(viewerId) ? "내 글·사진" : "블로그") : author.display_name || author.username}
        </Link>
        {/* 1.10.0 통합: 글·사진을 쓸 수 있는 계정은 옛 편집기로 들어가지 않는다(읽기만, 공개 전환·삭제는 목록에서) */}
        {isOwner && !postsOpenFor(viewerId) && (
          <Link
            href={`/${author.username}/blog/${post.id}/edit`}
            className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-1.5 text-xs font-medium text-charcoal-200 hover:border-charcoal-700 hover:text-white"
          >
            편집
          </Link>
        )}
      </div>

      <header>
        <p className="text-xs text-charcoal-500">
          @{author.username}
          {post.published_at ? (
            <>
              {" · "}
              <time>
                {new Date(post.published_at).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </>
          ) : isOwner ? (
            <>
              {" · "}
              <span className="rounded bg-charcoal-800/60 px-1.5 py-0.5 text-2xs text-charcoal-300">
                임시저장
              </span>
            </>
          ) : null}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-charcoal-50 md:text-4xl">
          {post.title}
        </h1>
      </header>

      {post.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover_image}
          alt=""
          className="w-full rounded-xl border border-charcoal-800/60 object-cover"
        />
      )}

      <PostBody text={post.content ?? ""} />

      <div className="border-t border-charcoal-800/40 pt-5">
        <ReactionStrip
          target_type="post"
          target_id={post.id}
          initial={reactions}
          loggedIn={!!session}
        />
        <CommentSection
          targetType="blog_post"
          targetId={post.id}
          loggedIn={!!session}
          viewerId={viewerId}
        />
      </div>
    </article>
  );
}
