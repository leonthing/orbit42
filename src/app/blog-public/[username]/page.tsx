import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedPosts } from "../actions";
import { SITE } from "@/lib/constants";

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
    alternates: {
      canonical: `${SITE.url}/blog-public/${params.username}`,
      types: {
        "application/rss+xml": `${SITE.url}/blog-public/${params.username}/rss.xml`,
      },
    },
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
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold text-charcoal-100">{name}</h1>
          <a
            href={`/blog-public/${params.username}/rss.xml`}
            aria-label="RSS 피드"
            title="RSS 피드"
            className="mt-1 text-charcoal-500 hover:text-navy-400"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.18 17.82a2.18 2.18 0 1 1-4.36 0 2.18 2.18 0 0 1 4.36 0ZM1.82 8.91v3.05c5.65 0 10.22 4.57 10.22 10.22h3.05c0-7.33-5.94-13.27-13.27-13.27Zm0-6.09v3.05c9.01 0 16.31 7.3 16.31 16.31h3.05C21.18 11.46 12.54 2.82 1.82 2.82Z" />
            </svg>
          </a>
        </div>
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
                {post.cover_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.cover_image}
                    alt=""
                    className="mb-3 max-h-56 w-full rounded-xl border border-charcoal-800/60 object-cover"
                  />
                )}
                <h2 className="text-xl font-semibold text-charcoal-100 group-hover:text-navy-400 transition-colors">
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
