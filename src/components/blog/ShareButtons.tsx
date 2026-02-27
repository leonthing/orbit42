"use client";

import { useEffect, useState } from "react";

interface ShareButtonsProps {
  title: string;
}

export function ShareButtons({ title }: ShareButtonsProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const shareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    alert("링크가 복사되었습니다!");
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-charcoal-500 dark:text-charcoal-400">
        공유:
      </span>
      <button
        onClick={shareTwitter}
        className="rounded-lg p-2 text-charcoal-500 transition-colors hover:bg-charcoal-100 hover:text-charcoal-700 dark:text-charcoal-400 dark:hover:bg-charcoal-800"
        aria-label="Twitter로 공유"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>
      <button
        onClick={copyLink}
        className="rounded-lg p-2 text-charcoal-500 transition-colors hover:bg-charcoal-100 hover:text-charcoal-700 dark:text-charcoal-400 dark:hover:bg-charcoal-800"
        aria-label="링크 복사"
      >
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
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </button>
    </div>
  );
}
