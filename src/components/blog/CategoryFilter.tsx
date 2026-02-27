"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";

export function CategoryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("category") || "All";

  const handleClick = (category: string) => {
    if (category === "All") {
      router.push("/blog");
    } else {
      router.push(`/blog?category=${encodeURIComponent(category)}`);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => handleClick(cat)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            current === cat
              ? "bg-navy-600 text-white dark:bg-navy-500"
              : "bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200 dark:bg-charcoal-800 dark:text-charcoal-400 dark:hover:bg-charcoal-700"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
