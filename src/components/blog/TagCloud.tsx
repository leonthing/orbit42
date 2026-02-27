"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface TagCloudProps {
  tags: { tag: string; count: number }[];
}

export function TagCloud({ tags }: TagCloudProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTag = searchParams.get("tag") || "";

  const handleClick = (tag: string) => {
    if (tag === currentTag) {
      // Deselect: keep category if present
      const category = searchParams.get("category");
      router.push(category ? `/blog?category=${encodeURIComponent(category)}` : "/blog");
    } else {
      router.push(`/blog?tag=${encodeURIComponent(tag)}`);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(({ tag, count }) => (
        <button
          key={tag}
          onClick={() => handleClick(tag.toLowerCase())}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            currentTag === tag.toLowerCase()
              ? "bg-navy-600 text-white dark:bg-navy-500"
              : "bg-navy-50 text-navy-700 hover:bg-navy-100 dark:bg-navy-950 dark:text-navy-300 dark:hover:bg-navy-900"
          }`}
        >
          {tag}
          <span
            className={
              currentTag === tag.toLowerCase()
                ? "text-navy-200"
                : "text-navy-500 dark:text-navy-400"
            }
          >
            ({count})
          </span>
        </button>
      ))}
    </div>
  );
}
