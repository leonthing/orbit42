import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession, getProfile } from "@/lib/auth";

export default async function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const viewer = await getProfile(session.username);
  return (
    <AppShell
      viewerUsername={session.username}
      viewerDisplayName={viewer?.display_name || session.username}
      viewerAvatarUrl={(viewer?.avatar_url as string | null) ?? null}
    >
      {children}
    </AppShell>
  );
}
