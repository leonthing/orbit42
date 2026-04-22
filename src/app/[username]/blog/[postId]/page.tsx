import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { getPublicPostBySlug } from "../actions";
import { getSession } from "@/lib/auth";
import { getReactionsFor } from "@/lib/reactions";
import { ReactionStrip } from "@/components/ReactionStrip";

export const dynamic = "force-dynamic";

// `postId` here is treated as the slug, since public links from feed/profile
// use slugs. The owner's edit page (under /[postId]/edit) still uses the UUID.
export async function generateMetadata({
  params,
}: {
  params: { username: string; postId: string };
}): Promise<Metadata> {
  const data = await getPublicPostBySlug(params.username, params.postId);
  if (!data) return { title: "Not found" };
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
  if (!data) notFound();
  const { post, author, isOwner } = data;

  const [session, reactions] = await Promise.all([
    getSession(),
    getReactionsFor("post", post.id),
  ]);

  return (
    <article className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={
            isOwner
              ? `/${author.username}/blog`
              : `/${author.username}`
          }
          className="inline-flex items-center gap-1 text-xs text-charcoal-400 hover:text-charcoal-100"
        >
          ← {isOwner ? "Blog" : author.display_name || author.username}
        </Link>
        {isOwner && (
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
              <span className="rounded bg-charcoal-800/60 px-1.5 py-0.5 text-[10px] text-charcoal-300">
                임시저장
              </span>
            </>
          ) : null}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-charcoal-50 md:text-4xl">
          {post.title}
        </h1>
      </header>

      <div className="post-body text-[15px] leading-relaxed text-charcoal-100">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{post.content}</ReactMarkdown>
      </div>

      <div className="border-t border-charcoal-800/40 pt-5">
        <ReactionStrip
          target_type="post"
          target_id={post.id}
          initial={reactions}
          loggedIn={!!session}
        />
      </div>
    </article>
  );
}
