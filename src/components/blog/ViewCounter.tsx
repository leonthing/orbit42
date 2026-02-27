"use client";

import { useEffect, useState } from "react";
import { recordView, getPostStats } from "@/app/blog/[slug]/actions";

interface ViewCounterProps {
  slug: string;
}

export function ViewCounter({ slug }: ViewCounterProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // 조회수 증가 + 현재 조회수 가져오기
    recordView(slug).then(() =>
      getPostStats(slug).then((stats) => setCount(stats.viewCount))
    );
  }, [slug]);

  return (
    <span className="flex items-center gap-1.5 text-sm text-charcoal-500 dark:text-charcoal-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>{count !== null ? count : "-"}</span>
    </span>
  );
}
