"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
      }}
      className="flex items-center gap-2"
    >
      <div className="relative flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500"
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
          placeholder="이름, @아이디, 슬롯 제목…"
          autoFocus
          className="w-full rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] py-2.5 pl-9 pr-3 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-charcoal-700 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
      >
        검색
      </button>
    </form>
  );
}
