import Link from "next/link";
import { PostMeta } from "@/types/post";

interface PostNavigationProps {
  prev: PostMeta | null;
  next: PostMeta | null;
}

export function PostNavigation({ prev, next }: PostNavigationProps) {
  return (
    <nav className="mt-10 flex justify-between gap-4 border-t border-charcoal-200 pt-6 dark:border-charcoal-800">
      {prev ? (
        <Link
          href={`/blog/${prev.slug}`}
          className="group flex-1 rounded-lg border border-charcoal-200 p-4 transition-colors hover:border-navy-300 dark:border-charcoal-700 dark:hover:border-navy-700"
        >
          <span className="text-xs text-charcoal-500 dark:text-charcoal-400">
            &larr; 이전 글
          </span>
          <p className="mt-1 text-sm font-medium text-charcoal-900 group-hover:text-navy-600 dark:text-charcoal-100 dark:group-hover:text-navy-400">
            {prev.title}
          </p>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
      {next ? (
        <Link
          href={`/blog/${next.slug}`}
          className="group flex-1 rounded-lg border border-charcoal-200 p-4 text-right transition-colors hover:border-navy-300 dark:border-charcoal-700 dark:hover:border-navy-700"
        >
          <span className="text-xs text-charcoal-500 dark:text-charcoal-400">
            다음 글 &rarr;
          </span>
          <p className="mt-1 text-sm font-medium text-charcoal-900 group-hover:text-navy-600 dark:text-charcoal-100 dark:group-hover:text-navy-400">
            {next.title}
          </p>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  );
}
