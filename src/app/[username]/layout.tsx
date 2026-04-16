import { AppShell } from "@/components/layout/AppShell";
import { PublicChrome } from "@/components/layout/PublicChrome";
import { getProfile, getSession } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/messages";
import { unreadNotificationCount } from "@/lib/notifications";
import { notFound } from "next/navigation";

export default async function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { username: string };
}) {
  const [profile, session] = await Promise.all([
    getProfile(params.username),
    getSession(),
  ]);

  if (!profile) notFound();

  if (!session) {
    return <PublicChrome viewerUsername={null}>{children}</PublicChrome>;
  }

  const [viewer, unread, unreadN] = await Promise.all([
    getProfile(session.username),
    unreadMessageCount(),
    unreadNotificationCount(),
  ]);
  const displayName = viewer?.display_name || session.username;
  const avatarUrl = (viewer?.avatar_url as string | null) ?? null;

  return (
    <AppShell
      viewerUsername={session.username}
      viewerDisplayName={displayName}
      viewerAvatarUrl={avatarUrl}
      unreadMessages={unread}
      unreadNotifications={unreadN}
    >
      {children}
    </AppShell>
  );
}
