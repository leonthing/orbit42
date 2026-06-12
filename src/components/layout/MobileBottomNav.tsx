"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileBottomNav({ username }: { username: string }) {
  const pathname = usePathname();

  const items = [
    {
      href: "/feed",
      label: "피드",
      active: pathname === "/feed",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      href: "/explore",
      label: "탐색",
      active: pathname === "/explore",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m21 21-4.3-4.3" />
        </svg>
      ),
    },
    {
      href: `/${username}/calendar`,
      label: "캘린더",
      active: pathname.startsWith(`/${username}/calendar`),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      ),
    },
    {
      href: `/${username}/slots`,
      label: "타임슬롯",
      active: pathname.startsWith(`/${username}/slots`),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      href: `/${username}`,
      label: "나",
      active: pathname === `/${username}`,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-charcoal-800/60 bg-[rgb(var(--bg-surface))]/95 backdrop-blur md:hidden"
      style={{
        // 실제 탭 영역 64px + iPhone 홈 인디케이터만큼 추가 하단 여유
        height: "calc(4rem + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            it.active ? "text-red-400" : "text-charcoal-500"
          }`}
        >
          <span className="relative">
            <span className="[&>svg]:h-6 [&>svg]:w-6">{it.icon}</span>
          </span>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
