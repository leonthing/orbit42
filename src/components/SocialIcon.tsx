/**
 * 소셜 링크 아이콘 — 단색 글리프(currentColor), iOS SocialIcons.swift 와 같은 24×24 모양.
 * 프로필 소셜 줄(/[username])과 공개 링크 페이지(PublicLinkProfile)가 함께 쓴다.
 * 목록에 없는 서비스·일반 주소는 링크(지구본) 아이콘.
 */
import type React from "react";

export const SOCIAL_ICONS: Record<string, { label: string; icon: React.ReactNode }> = {
  instagram: {
    label: "인스타그램",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
    ),
  },
  x: {
    label: "X",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" />
    </svg>
    ),
  },
  youtube: {
    label: "유튜브",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
    ),
  },
  facebook: {
    label: "페이스북",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
    ),
  },
  linkedin: {
    label: "링크드인",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C21.4 8.65 22 11 22 14.2V21h-4v-6c0-1.5 0-3.4-2.1-3.4s-2.4 1.6-2.4 3.3V21h-4V9Z" />
    </svg>
    ),
  },
};

export const LINK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
  </svg>
);

/** 키로 아이콘·이름 — 모르는 키는 지구본 + 주소의 도메인 */
export function socialIconFor(key: string, url: string): { label: string; icon: React.ReactNode } {
  const known = SOCIAL_ICONS[key];
  if (known) return known;
  let host = key;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  return { label: host, icon: LINK_ICON };
}
