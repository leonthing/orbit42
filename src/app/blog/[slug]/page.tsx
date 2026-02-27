import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug, getAdjacentPosts } from "@/lib/posts";
import { compilePost } from "@/lib/mdx";
import { TagBadge } from "@/components/blog/TagBadge";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { PostNavigation } from "@/components/blog/PostNavigation";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { SITE } from "@/lib/constants";
import { Comments } from "@/components/blog/Comments";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      url: `${SITE.url}/blog/${post.slug}`,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  const content = await compilePost(post.content);
  const { prev, next } = await getAdjacentPosts(params.slug);
  const isAdmin = cookies().get("admin_session")?.value === "authenticated";

  return (
    <div className="relative">
      <TableOfContents />
      <article>
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm text-charcoal-500 dark:text-charcoal-400">
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            <span>&middot;</span>
            <span>{post.readingTime}</span>
            <span>&middot;</span>
            <span className="text-navy-600 dark:text-navy-400">
              {post.category}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100 sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-lg text-charcoal-600 dark:text-charcoal-400">
            {post.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </header>

        <div className="prose prose-charcoal max-w-none dark:prose-invert">
          {content}
        </div>

        <footer className="mt-10 border-t border-charcoal-200 pt-6 dark:border-charcoal-800">
          <ShareButtons title={post.title} />
        </footer>
      </article>
      <Comments postSlug={params.slug} isAdmin={isAdmin} />
      <PostNavigation prev={prev} next={next} />
    </div>
  );
}
