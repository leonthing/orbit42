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

  // 공개 프로필은 "사람"이 먼저 보여야 하므로 네비를 아래로 내리고,
  // 배경은 사용자가 고른 링크 테마가 칠한다.
  if (!session) {
    return (
      <PublicChrome viewerUsername={null} navAtBottom bare>
        {children}
      </PublicChrome>
    );
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
