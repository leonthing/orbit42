import Link from "next/link";
import { PostMeta } from "@/types/post";
import { TagBadge } from "./TagBadge";

interface PostCardProps {
  post: PostMeta;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="group">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="rounded-lg border border-charcoal-200 p-5 transition-all hover:border-navy-300 hover:shadow-sm dark:border-charcoal-800 dark:hover:border-navy-700">
          <div className="mb-2 flex items-center gap-2 text-sm text-charcoal-500 dark:text-charcoal-400">
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
          <h2 className="mb-2 text-xl font-semibold text-charcoal-900 group-hover:text-navy-600 dark:text-charcoal-100 dark:group-hover:text-navy-400">
            {post.title}
          </h2>
          {post.description && (
            <p className="mb-2 text-charcoal-600 dark:text-charcoal-400">
              {post.description}
            </p>
          )}
          {post.excerpt && (
            <p className="mb-3 text-sm leading-relaxed text-charcoal-500 dark:text-charcoal-500">
              {post.excerpt}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}
