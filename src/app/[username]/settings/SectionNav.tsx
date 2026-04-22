"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string };

/**
 * Sticky section nav for Settings. Desktop: vertical rail on the left.
 * Mobile: horizontal chip bar pinned under the top bar.
 */
export function SectionNav({ items }: { items: Item[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const targets = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort(
          (a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top,
        );
        setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [items]);

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Settings sections"
        className="hidden lg:sticky lg:top-4 lg:block lg:w-44 lg:shrink-0 lg:self-start"
      >
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active === item.id
                    ? "bg-red-600/15 text-red-400"
                    : "text-charcoal-500 hover:bg-charcoal-800/40 hover:text-charcoal-200"
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile / tablet chip row */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 bg-[rgb(var(--bg-base))]/95 px-4 py-2 backdrop-blur lg:hidden">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                active === item.id
                  ? "bg-red-600/15 text-red-400"
                  : "bg-charcoal-900/40 text-charcoal-400 hover:text-charcoal-200"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
