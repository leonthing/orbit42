"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string };

/**
 * Sticky section nav for Settings. Desktop: vertical rail on the left.
 * Mobile: horizontal chip bar pinned under the top bar.
 */
export function SectionNav({ items }: { items: Item[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  // `#bio` 처럼 해시를 달고 들어오면 브라우저가 알아서 스크롤해야 하지만,
  // 서버 컴포넌트가 스트리밍되는 동안에는 대상 요소가 아직 없어서 그냥 넘어간다.
  // (시작하기 체크리스트 → 설정#bio 가 이 경우였다.) 마운트 후 한 번 더 시도한다.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    let cancelled = false;
    // 폼이 늦게 하이드레이션되므로 잠깐 재시도한다.
    const tryScroll = (attempt = 0) => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "start" });
        setActive(id);
        return;
      }
      if (attempt < 20) setTimeout(() => tryScroll(attempt + 1), 100);
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, []);

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
                className={`block rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active === item.id
                    ? "bg-navy-500/15 text-navy-400"
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
      <div className="sticky top-0 z-10 w-full bg-[rgb(var(--bg-base))]/95 py-2 backdrop-blur lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-2xs font-medium transition-colors ${
                active === item.id
                  ? "bg-navy-500/15 text-navy-400"
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
