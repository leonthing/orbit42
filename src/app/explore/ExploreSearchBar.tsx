"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExploreSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        if (!term) return;
        router.push(`/search?q=${encodeURIComponent(term)}`);
      }}
      className="relative"
    >
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름, @아이디, 슬롯 제목 검색…"
        className="w-full rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 py-3 pl-11 pr-4 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-charcoal-700 focus:outline-none"
      />
    </form>
  );
}
