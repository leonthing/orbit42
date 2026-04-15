import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession, getProfile } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/messages";

export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [viewer, unread] = await Promise.all([
    getProfile(session.username),
    unreadMessageCount(),
  ]);
  return (
    <AppShell
      viewerUsername={session.username}
      viewerDisplayName={viewer?.display_name || session.username}
      viewerAvatarUrl={(viewer?.avatar_url as string | null) ?? null}
      unreadMessages={unread}
    >
      {children}
    </AppShell>
  );
}
