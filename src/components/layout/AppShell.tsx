import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileMenuProvider } from "@/components/layout/MobileMenuContext";

/**
 * Authenticated shell: sidebar + topbar wrapping the page content.
 * Used on /feed, /explore, /[username] and all of its sub-routes
 * whenever the viewer is signed in.
 */
export function AppShell({
  viewerUsername,
  viewerDisplayName,
  viewerAvatarUrl = null,
  children,
}: {
  viewerUsername: string;
  viewerDisplayName: string;
  viewerAvatarUrl?: string | null;
  children: React.ReactNode;
}) {
  return (
    <MobileMenuProvider>
      <div className="flex h-screen overflow-hidden bg-[rgb(var(--bg-base))]">
        <Sidebar username={viewerUsername} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            username={viewerUsername}
            displayName={viewerDisplayName}
            avatarUrl={viewerAvatarUrl}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="w-full px-3 py-3 sm:px-4 md:px-6 md:py-5">
              {children}
            </div>
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
