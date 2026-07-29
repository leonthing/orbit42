import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileMenuProvider } from "@/components/layout/MobileMenuContext";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

/**
 * Authenticated shell: sidebar + topbar wrapping the page content.
 * Used on /feed, /explore, /[username] and all of its sub-routes
 * whenever the viewer is signed in.
 */
export function AppShell({
  viewerUsername,
  viewerDisplayName,
  viewerAvatarUrl = null,
  unreadMessages = 0,
  unreadNotifications = 0,
  children,
}: {
  viewerUsername: string;
  viewerDisplayName: string;
  viewerAvatarUrl?: string | null;
  unreadMessages?: number;
  unreadNotifications?: number;
  children: React.ReactNode;
}) {
  return (
    <MobileMenuProvider>
      <div className="flex h-screen overflow-hidden bg-[rgb(var(--bg-base))]">
        <Sidebar username={viewerUsername} unreadMessages={unreadMessages} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            username={viewerUsername}
            displayName={viewerDisplayName}
            avatarUrl={viewerAvatarUrl}
            unreadNotifications={unreadNotifications}
            unreadMessages={unreadMessages}
          />
          <main
            className="flex-1 overflow-y-auto pb-[var(--mobile-nav-pb)] md:!pb-0"
            style={
              {
                "--mobile-nav-pb": "calc(4rem + env(safe-area-inset-bottom))",
              } as React.CSSProperties
            }
          >
            {/* h-full 이라야 캘린더처럼 "화면을 채우는" 페이지가 flex-1 로
                남은 높이를 가져갈 수 있다. 짧은 페이지에는 영향이 없다. */}
            <div className="h-full w-full px-4 py-4 sm:px-5 md:px-6 md:py-5">
              {children}
            </div>
          </main>
        </div>
        <MobileBottomNav username={viewerUsername} />
      </div>
    </MobileMenuProvider>
  );
}
