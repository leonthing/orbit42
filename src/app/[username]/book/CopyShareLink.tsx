"use client";

import { useState } from "react";

export function CopyShareLink({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/${username}/book`
        : `/${username}/book`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-charcoal-950 hover:bg-amber-400"
    >
      {copied ? "복사됨!" : "링크 복사"}
    </button>
  );
}
