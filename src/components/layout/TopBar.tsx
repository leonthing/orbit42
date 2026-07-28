"use client";

import Link from "next/link";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMobileMenu } from "./MobileMenuContext";
import { Avatar } from "@/components/Avatar";
import { NotificationBell } from "./NotificationBell";

export function TopBar({
  username,
  displayName,
  avatarUrl = null,
  unreadNotifications = 0,
  unreadMessages = 0,
}: {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  unreadNotifications?: number;
  unreadMessages?: number;
}) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const { toggle } = useMobileMenu();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-charcoal-800/40 px-4 md:px-6">
      {/* Left: Hamburger (mobile only — desktop clock lives in the sidebar) */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-200 md:hidden"
          aria-label="메뉴 열기"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          {unreadMessages > 0 && (
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-navy-400"
              aria-label={`안 읽은 메시지 ${unreadMessages}개`}
            />
          )}
        </button>
      </div>

      {/* Right: Bell + User */}
      <div className="flex items-center gap-1">
        <NotificationBell initialUnread={unreadNotifications} />
        <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          aria-label="계정 메뉴"
          aria-expanded={showMenu}
          className="flex max-w-[160px] items-center gap-2 rounded-lg px-2 py-1 hover:bg-charcoal-800/50 sm:max-w-[220px]"
        >
          <Avatar url={avatarUrl} name={displayName} size={28} />
          <span className="hidden truncate text-sm text-charcoal-300 sm:inline">
            {displayName}
          </span>
          <svg className="hidden h-3 w-3 shrink-0 text-charcoal-500 sm:block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-1.5 shadow-2xl">
              <Link
                href={`/${username}`}
                onClick={() => setShowMenu(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-charcoal-300 hover:bg-charcoal-800/50"
              >
                <svg className="h-4 w-4 text-charcoal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                프로필
              </Link>
              <Link
                href={`/${username}/settings`}
                onClick={() => setShowMenu(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-charcoal-300 hover:bg-charcoal-800/50"
              >
                <svg className="h-4 w-4 text-charcoal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                설정
              </Link>
              <div className="my-1 border-t border-charcoal-800/40" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-charcoal-300 hover:bg-charcoal-800/50 hover:text-navy-400"
              >
                <svg className="h-4 w-4 text-charcoal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                로그아웃
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </header>
  );
}
