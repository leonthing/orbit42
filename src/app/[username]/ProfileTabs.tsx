"use client";

import { useState, type ReactNode } from "react";

type TabKey = "overview" | "slots" | "posts";

type Tab = {
  key: TabKey;
  label: string;
  count?: number;
};

type Props = {
  tabs: Tab[];
  overview: ReactNode;
  slots: ReactNode;
  posts: ReactNode;
};

/**
 * Owner-only tab shell on the profile page. Keeps three content groups
 * mounted so switching stays snappy; only the active one is visible.
 */
export function ProfileTabs({ tabs, overview, slots, posts }: Props) {
  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? "overview");

  return (
    <div>
      <div
        role="tablist"
        aria-label="프로필 섹션"
        className="mb-5 flex items-center gap-1 border-b border-charcoal-800/60"
      >
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tab-${t.key}`}
              id={`tabctl-${t.key}`}
              type="button"
              onClick={() => setActive(t.key)}
              className={`relative -mb-px px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "font-semibold text-charcoal-100"
                  : "text-charcoal-500 hover:text-charcoal-200"
              }`}
            >
              <span>{t.label}</span>
              {typeof t.count === "number" && t.count > 0 && (
                <span
                  className={`ml-1.5 text-[11px] ${
                    isActive ? "text-red-400" : "text-charcoal-600"
                  }`}
                >
                  {t.count}
                </span>
              )}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-t bg-red-500"
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="tab-overview"
        aria-labelledby="tabctl-overview"
        hidden={active !== "overview"}
      >
        {overview}
      </div>
      <div
        role="tabpanel"
        id="tab-slots"
        aria-labelledby="tabctl-slots"
        hidden={active !== "slots"}
      >
        {slots}
      </div>
      <div
        role="tabpanel"
        id="tab-posts"
        aria-labelledby="tabctl-posts"
        hidden={active !== "posts"}
      >
        {posts}
      </div>
    </div>
  );
}
