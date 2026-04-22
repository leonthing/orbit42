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
  const { post, author } = data;

  const [session, reactions] = await Promise.all([
    getSession(),
    getReactionsFor("post", post.id),
  ]);

  return (
    <article className="max-w-3xl space-y-6">
      <Link
        href={`/${author.username}`}
        className="inline-flex items-center gap-1 text-xs text-charcoal-400 hover:text-charcoal-100"
      >
        ← {author.display_name || author.username}
      </Link>

      <header>
        <p className="text-xs text-charcoal-500">
          @{author.username}
          {post.published_at && (
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
          )}
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
