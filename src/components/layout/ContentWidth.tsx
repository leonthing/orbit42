"use client";

import { usePathname } from "next/navigation";

/**
 * PC 본문 폭 규칙 하나(11/21 묶음 바) — 휴대폰(md 미만)은 손대지 않는다.
 * - 넓게(꽉 참): 캘린더·리포트·프로필(xl 2단)·오르빗(xl 2단)·탐색
 * - 설정: 가운데 최대 1024
 * - 목록형(예약·예약 링크·타임라인·서비스 메뉴·블로그·팔로워/팔로잉): 가운데 최대 896
 * - 대화(PC 2단 목록+방): 가운데 최대 896
 * - 한 줄 흐름(할 일·알림): 가운데 최대 672
 * 예전엔 화면마다 꽉 참 / 왼쪽 672 / 가운데 672 / 왼쪽 1024 로 제각각이었다.
 */
export function ContentWidth({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const seg = (() => {
    // 대화방은 PC 2단(목록 + 방, lg~)이라 예약 탭과 같은 896(묶음 사)
    if (path.startsWith("/messages")) return "list";
    if (path.startsWith("/notifications")) return "narrow";
    if (path.startsWith("/explore") || path.startsWith("/feed")) return "wide";
    const m = /^\/[^/]+(?:\/([^/]+))?/.exec(path);
    const sub = m?.[1];
    if (!sub) return "wide"; // 프로필
    if (["calendar", "insights", "people", "c"].includes(sub)) return "wide";
    if (sub === "settings") return "settings";
    if (sub === "todos") return "narrow";
    return "list";
  })();
  const cls =
    seg === "wide"
      ? "md:h-full"
      : seg === "settings"
        ? "md:h-full md:mx-auto md:max-w-5xl"
        : seg === "list"
          ? "md:h-full md:mx-auto md:max-w-4xl"
          : "md:h-full md:mx-auto md:max-w-2xl";
  return (
    <div className={cls} data-content-width={seg}>
      {children}
    </div>
  );
}
