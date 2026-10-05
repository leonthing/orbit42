"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 모바일 하단 탭 — iOS 앱(MainTabView)과 같은 5탭·같은 모양.
 * 캘린더 / 예약 / 오르빗 / 리포트 / 프로필. 예약 링크(슬롯)는 앱처럼 예약 탭 안의
 * 세그먼트로 들어가고, 나머지 메뉴는 프로필 탭에서 연다.
 */
export function MobileBottomNav({ username }: { username: string }) {
  const pathname = usePathname();
  const base = `/${username}`;
  const under = (...paths: string[]) => paths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const items = [
    {
      href: `${base}/calendar`,
      label: "캘린더",
      active: under(`${base}/calendar`),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="2.5" y="4" width="19" height="17" rx="3.5" />
          <rect x="7" y="2" width="1.8" height="4" rx="0.9" />
          <rect x="15.2" y="2" width="1.8" height="4" rx="0.9" />
          {[8, 12, 16].map((x) =>
            [12, 16].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="rgb(var(--bg-surface))" />),
          )}
          <rect x="2.5" y="8" width="19" height="0.9" fill="rgb(var(--bg-surface))" />
        </svg>
      ),
    },
    {
      href: `${base}/bookings`,
      label: "예약",
      active: under(`${base}/bookings`, `${base}/slots`, `${base}/services`),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm4.28 7.53a.75.75 0 0 0-1.06-1.06l-4.47 4.47-1.97-1.97a.75.75 0 1 0-1.06 1.06l2.5 2.5c.3.3.77.3 1.06 0l5-5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      href: `${base}/people`,
      label: "오르빗",
      active: under(`${base}/people`, "/explore", "/search", "/messages"),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Z" clipRule="evenodd" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <circle key={i} cx={12 + 5.6 * Math.cos(a)} cy={12 + 5.6 * Math.sin(a)} r="0.85" fill="rgb(var(--bg-surface))" />;
          })}
        </svg>
      ),
    },
    {
      href: `${base}/insights`,
      label: "리포트",
      active: under(`${base}/insights`),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Z" clipRule="evenodd" />
          {/* 막대 그래프 — 리포트 */}
          <rect x="7.2" y="12.5" width="2.2" height="4.5" rx="0.6" fill="rgb(var(--bg-surface))" />
          <rect x="10.9" y="9.5" width="2.2" height="7.5" rx="0.6" fill="rgb(var(--bg-surface))" />
          <rect x="14.6" y="7" width="2.2" height="10" rx="0.6" fill="rgb(var(--bg-surface))" />
        </svg>
      ),
    },
    {
      href: base,
      label: "프로필",
      active:
        pathname === base ||
        under(`${base}/settings`, `${base}/timeline`, `${base}/blog`, `${base}/followers`, `${base}/following`, "/notifications"),
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM9 9.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm-2.7 8.1a7.9 7.9 0 0 1 11.4 0A8.2 8.2 0 0 1 12 20.25a8.2 8.2 0 0 1-5.7-2.65Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 md:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {/* 떠 있는 캡슐 — iOS 탭바와 같은 모양 */}
      <div className="pointer-events-auto mx-auto flex h-[62px] max-w-md items-center gap-1 rounded-full border border-black/5 bg-[rgb(var(--bg-surface))]/90 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition-colors ${
              it.active ? "bg-charcoal-800/60 text-navy-500 dark:text-navy-400" : "text-charcoal-100"
            }`}
          >
            <span className="h-[22px] w-[22px] [&>svg]:h-full [&>svg]:w-full">{it.icon}</span>
            <span>{it.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
