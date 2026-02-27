import Link from "next/link";

interface TagBadgeProps {
  tag: string;
  count?: number;
}

export function TagBadge({ tag, count }: TagBadgeProps) {
  return (
    <Link
      href={`/blog?tag=${encodeURIComponent(tag.toLowerCase())}`}
      className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-100 dark:bg-navy-950 dark:text-navy-300 dark:hover:bg-navy-900"
    >
      {tag}
      {count !== undefined && (
        <span className="text-navy-500 dark:text-navy-400">({count})</span>
      )}
    </Link>
  );
}
