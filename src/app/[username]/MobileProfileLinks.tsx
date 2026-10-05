"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

/**
 * 모바일 프로필 탭의 메뉴 목록 — iOS 프로필 화면의 행들과 같은 자리.
 * 하단 탭이 5개뿐이라 나머지 메뉴(예전 햄버거 서랍)는 여기로 모았다.
 */
export function MobileProfileLinks({ username, unreadMessages = 0 }: { username: string; unreadMessages?: number }) {
  const router = useRouter();
  const rows: Array<{ href: string; label: string; sub: string }> = [
    { href: `/${username}/slots`, label: "예약 링크", sub: "내 예약 링크 만들고 공유하기" },
    { href: `/${username}/timeline`, label: "타임라인", sub: "완료한 일정과 팔로잉의 기록" },
    { href: "/messages", label: "메시지", sub: unreadMessages > 0 ? `안 읽은 메시지 ${unreadMessages}개` : "주고받은 메시지" },
    { href: "/explore", label: "탐색", sub: "다른 사람들의 열린 시간" },
    { href: `/${username}/services`, label: "서비스 메뉴", sub: "예약에 붙이는 추가 메뉴" },
    { href: `/${username}/blog`, label: "블로그", sub: "내 글" },
    { href: `/${username}/settings`, label: "설정", sub: "프로필·캘린더·결제 안내·알림" },
  ];
  return (
    <div className="space-y-3 md:hidden">
      <ul className="divide-y divide-charcoal-800/50 overflow-hidden rounded-2xl bg-[rgb(var(--bg-surface))]">
        {rows.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="flex items-center gap-3 px-4 py-3 active:bg-charcoal-800/40">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-charcoal-50">{r.label}</p>
                <p className="truncate text-xs text-charcoal-500">{r.sub}</p>
              </div>
              <svg className="h-4 w-4 shrink-0 text-charcoal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="w-full rounded-2xl bg-[rgb(var(--bg-surface))] px-4 py-3 text-[15px] font-medium text-red-500"
      >
        로그아웃
      </button>
    </div>
  );
}
