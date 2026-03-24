import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
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
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      <Sidebar username={params.username} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar username={params.username} displayName={displayName} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
