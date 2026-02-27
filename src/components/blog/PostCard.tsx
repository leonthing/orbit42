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
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
            {(post.viewCount !== undefined || post.likeCount !== undefined) && (
              <div className="flex items-center gap-3 text-xs text-charcoal-400 dark:text-charcoal-500">
                {post.viewCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {post.viewCount}
                  </span>
                )}
                {post.likeCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-3.5 w-3.5"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    {post.likeCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
