import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileMenuProvider } from "@/components/layout/MobileMenuContext";
import { getProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  const displayName = profile?.display_name || params.username;

  return (
    <MobileMenuProvider>
      <div className="flex h-screen overflow-hidden bg-[rgb(var(--bg-base))]">
        <Sidebar username={params.username} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar username={params.username} displayName={displayName} />
          <main className="flex-1 overflow-y-auto">
            <div className="px-4 py-4 md:px-6 md:py-5">{children}</div>
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
