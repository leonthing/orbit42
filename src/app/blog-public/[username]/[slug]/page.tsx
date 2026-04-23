import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { getPublishedPost } from "../../actions";
import { JsonLd } from "@/components/JsonLd";
import { SITE } from "@/lib/constants";

export async function generateMetadata({
  params,
}: {
  params: { username: string; slug: string };
}): Promise<Metadata> {
  const result = await getPublishedPost(params.username, params.slug);
  if (!result) return { title: "Not Found" };
  const description =
    result.post.excerpt || result.post.content.slice(0, 160);
  const url = `${SITE.url}/blog-public/${params.username}/${params.slug}`;
  return {
    title: result.post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: result.post.title,
      description,
      url,
      type: "article",
      publishedTime: result.post.published_at,
      authors: [result.author.display_name || result.author.username],
      tags: result.post.tags,
      siteName: SITE.title,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: result.post.title,
      description,
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

export default async function BlogPostPage({
  params,
}: {
  params: { username: string; slug: string };
}) {
  const result = await getPublishedPost(params.username, params.slug);
  if (!result) notFound();

  const { author, post } = result;
  const name = author.display_name || author.username;
  const postUrl = `${SITE.url}/blog-public/${params.username}/${params.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || post.content.slice(0, 160),
    datePublished: post.published_at,
    author: {
      "@type": "Person",
      name,
      url: `${SITE.url}/${author.username}`,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.title,
      logo: {
        "@type": "ImageObject",
        url: `${SITE.url}/icon-512.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    keywords: post.tags.join(", ") || undefined,
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      {/* Back link */}
      <Link
        href={`/${params.username}`}
        className="mb-8 inline-flex items-center gap-1 text-sm text-charcoal-500 hover:text-charcoal-300 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        {name}
      </Link>

      <article>
        {/* Title */}
        <h1 className="text-3xl font-bold text-charcoal-100 leading-tight">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-charcoal-500">
          <time>{formatDate(post.published_at)}</time>
          {post.tags.length > 0 && (
            <>
              <span>·</span>
              {post.tags.map((tag) => (
                <span key={tag} className="rounded bg-charcoal-800/60 px-2 py-0.5 text-xs text-charcoal-400">
                  {tag}
                </span>
              ))}
            </>
          )}
        </div>

        {/* Content */}
        <div className="mt-8 prose prose-invert prose-base max-w-none prose-headings:text-charcoal-100 prose-p:text-charcoal-300 prose-strong:text-charcoal-200 prose-a:text-red-400 prose-code:text-emerald-400 prose-code:bg-charcoal-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-charcoal-800 prose-pre:border prose-pre:border-charcoal-700 prose-blockquote:border-red-500 prose-blockquote:text-charcoal-400 prose-li:text-charcoal-300 prose-hr:border-charcoal-700 prose-th:text-charcoal-200 prose-td:text-charcoal-300 prose-img:rounded-lg">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{post.content}</ReactMarkdown>
        </div>
      </article>
    </>
  );
}
