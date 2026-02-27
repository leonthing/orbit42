"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleLike, checkLiked, getPostStats } from "@/app/blog/[slug]/actions";

function getVisitorId(): string {
  const key = "orbit42_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

interface LikeButtonProps {
  slug: string;
}

export function LikeButton({ slug }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    const visitorId = getVisitorId();

    Promise.all([checkLiked(slug, visitorId), getPostStats(slug)]).then(
      ([isLiked, stats]) => {
        setLiked(isLiked);
        setCount(stats.likeCount);
      }
    );
  }, [slug]);

  const handleClick = () => {
    if (isPending) return;

    const visitorId = getVisitorId();
    // Optimistic update
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));

    startTransition(async () => {
      const result = await toggleLike(slug, visitorId);
      if ("error" in result) {
        // Revert on error
        setLiked(!newLiked);
        setCount((c) => c + (newLiked ? -1 : 1));
      }
    });
  };

  if (!mounted) {
    return (
      <button
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-charcoal-500 dark:text-charcoal-400"
        disabled
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-4 w-4"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span>0</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        liked
          ? "text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
          : "text-charcoal-500 hover:text-red-500 dark:text-charcoal-400 dark:hover:text-red-400"
      }`}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        className="h-4 w-4"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span>{count}</span>
    </button>
  );
}
