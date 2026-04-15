import { AppShell } from "@/components/layout/AppShell";
import { PublicChrome } from "@/components/layout/PublicChrome";
import { getSession, getProfile } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/messages";

export default async function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    return <PublicChrome viewerUsername={null}>{children}</PublicChrome>;
  }
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
