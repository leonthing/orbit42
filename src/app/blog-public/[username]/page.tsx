import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedPosts } from "../actions";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const result = await getPublishedPosts(params.username);
  if (!result) return { title: "Blog" };

  const name = result.author.display_name || result.author.username;
  return {
    title: `${name}'s Blog`,
    description: result.author.bio || `${name}의 블로그`,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogHomePage({
  params,
}: {
  params: { username: string };
}) {
  const result = await getPublishedPosts(params.username);
  if (!result) notFound();

  const { author, posts } = result;
  const name = author.display_name || author.username;

  return (
    <>
      {/* Header */}
      <header className="mb-10 border-b border-charcoal-800/40 pb-8">
        <h1 className="text-3xl font-bold text-charcoal-100">{name}</h1>
        {author.bio && (
          <p className="mt-2 text-sm text-charcoal-400">{author.bio}</p>
        )}
      </header>

      {/* Posts */}
      {posts.length === 0 ? (
        <p className="py-20 text-center text-sm text-charcoal-500">
          아직 게시된 글이 없습니다.
        </p>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <article key={post.id}>
              <Link
                href={`/${params.username}/${post.slug}`}
                className="group block"
              >
                <h2 className="text-xl font-semibold text-charcoal-100 group-hover:text-red-400 transition-colors">
                  {post.title}
                </h2>
                {(post.excerpt || post.content) && (
                  <p className="mt-2 text-sm text-charcoal-400 line-clamp-2">
                    {post.excerpt || post.content.replace(/[#*_`>\-\[\]()!]/g, "").slice(0, 200)}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-charcoal-500">
                  <time>{formatDate(post.published_at)}</time>
                  {post.tags.length > 0 && (
                    <>
                      <span>·</span>
                      {post.tags.map((tag) => (
                        <span key={tag} className="rounded bg-charcoal-800/60 px-1.5 py-0.5 text-charcoal-400">
                          {tag}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
