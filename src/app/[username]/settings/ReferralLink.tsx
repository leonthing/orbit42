"use client";

import { useState } from "react";

export function ReferralLink({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://orbit42.org";
  const url = `${origin}/signup?ref=${encodeURIComponent(username)}`;

  const copy = async () => {
    const text = `${url}\n\nOrbit42 에 초대합니다. 제 추천으로 가입하면 자동으로 연결돼요.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
      <h2 className="mb-1 text-sm font-semibold text-charcoal-200">추천 링크</h2>
      <p className="mb-4 text-xs text-charcoal-500">
        이 링크로 가입한 사람은 가입 즉시 당신과 서로 팔로우 연결돼요.
      </p>

      <div className="flex items-center gap-2 rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-charcoal-200">
          {url}
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>

      <p className="mt-3 text-[11px] text-charcoal-500">
        또는 가입 폼에 추천인 란에 <span className="font-mono text-charcoal-300">@{username}</span>{" "}
        만 넣어도 돼요.
      </p>
    </div>
  );
}
