"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/PendingButton";

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
      className={buttonClasses({ size: "sm" })}
    >
      {copied ? "복사됨!" : "링크 복사"}
    </button>
  );
}
