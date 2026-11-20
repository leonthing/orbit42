"use client";

/**
 * document.body 로 띄우는 겹친 화면(포털)은 앱 화면(AppShell) 밖이라 다크 색이 안 걸린다.
 * 앱 안에서 띄웠을 때만 data-app-shell-portal 을 달아 같은 모드를 따르게 한다 — 공개 페이지에서 띄운 것은 그대로(묶음 5).
 */
export function AppPortalScope({ children }: { children: React.ReactNode }) {
  const inApp = typeof document !== "undefined" && !!document.querySelector("[data-app-shell]");
  return inApp ? (
    <div data-app-shell-portal className="contents">
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
