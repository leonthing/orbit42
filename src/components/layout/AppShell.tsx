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
          />
          <main
            className="flex-1 overflow-y-auto pb-[var(--mobile-nav-pb)] md:!pb-0"
            style={
              {
                "--mobile-nav-pb": "calc(4rem + env(safe-area-inset-bottom))",
              } as React.CSSProperties
            }
          >
            <div className="w-full px-4 py-4 sm:px-5 md:px-6 md:py-5">
              {children}
            </div>
          </main>
        </div>
        <MobileBottomNav
          username={viewerUsername}
          unreadNotifications={unreadNotifications}
        />
      </div>
    </MobileMenuProvider>
  );
}
