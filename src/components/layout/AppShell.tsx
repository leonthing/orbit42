import { ThemeColorSync } from "@/components/layout/ThemeColorSync";
import { Sidebar } from "@/components/layout/Sidebar";
import { v190OpenFor } from "@/lib/dm-flags";
import { TopBar } from "@/components/layout/TopBar";
import { MobileMenuProvider } from "@/components/layout/MobileMenuContext";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ContentWidth } from "@/components/layout/ContentWidth";

/**
 * Authenticated shell: sidebar + topbar wrapping the page content.
 * Used on /feed, /explore, /[username] and all of its sub-routes
 * whenever the viewer is signed in.
 */
export async function AppShell({
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
  // 사이드바 미니 달력도 주 시작 요일 설정을 따른다.
  const { getAdminClient } = await import("@/lib/supabase");
  const { data: wsRow } = await getAdminClient()
    .from("users")
    .select("id, week_start")
    .eq("username", viewerUsername)
    .maybeSingle();
  const weekStart = (wsRow as { week_start?: string } | null)?.week_start === "sun" ? "sun" : "mon";
  // 예약 메뉴 옆 숫자 — 앱 예약 탭 배지와 같은 셈 (개선-30)
  const viewerId = (wsRow as { id?: string } | null)?.id;
  const { bookingsNeedingReplyCount } = await import("@/lib/booking-badge");
  // + 안 읽은 예약 대화가 있는 예약 수 (1.8.0)
  const { unreadChatThreadCount } = await import("@/lib/booking-chat");
  const [needReply, unreadChats] = viewerId
    ? await Promise.all([
        bookingsNeedingReplyCount(viewerId).catch(() => 0),
        unreadChatThreadCount(viewerId).catch(() => 0),
      ])
    : [0, 0];
  // + 1:1 안 읽음(iOS 예약 탭 배지와 같은 셈: 대기 예약 + 예약 대화 + 1:1, 11/22 PO). 숫자는 unreadDmCount 한 곳에서 세어 레이아웃이 넘긴다 —
  // 휴대폰 탭 막대·PC 왼쪽 메뉴가 같은 bookingsBadge 를 쓴다(PC 의 '1:1만 있을 때 빨간 점'은 이제 숫자로 보인다).
  const bookingsBadge = needReply + unreadChats + unreadMessages;
  const postsOpen = (await import("@/lib/posts-access")).postsOpenFor(viewerId);

  return (
    <MobileMenuProvider>
      <div data-app-shell className="flex h-dvh overflow-hidden bg-[rgb(var(--bg-base))]">
        <ThemeColorSync />
        <Sidebar username={viewerUsername} unreadMessages={unreadMessages} bookingsBadge={bookingsBadge} weekStart={weekStart} dmOpen={v190OpenFor(viewerId)} postsOpen={postsOpen} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            username={viewerUsername}
            postsOpen={postsOpen}
            displayName={viewerDisplayName}
            avatarUrl={viewerAvatarUrl}
            unreadNotifications={unreadNotifications}
            unreadMessages={unreadMessages}
          />
          <main
            className="flex-1 overflow-y-auto pb-[var(--mobile-nav-pb)] md:!pb-0"
            style={
              {
                "--mobile-nav-pb": "calc(5.75rem + env(safe-area-inset-bottom))",
              } as React.CSSProperties
            }
          >
            {/* h-full 이라야 캘린더처럼 "화면을 채우는" 페이지가 flex-1 로
                남은 높이를 가져갈 수 있다(데스크톱). 휴대폰은 h-full 이면 긴 내용이 이 상자를 넘쳐
                main 의 아래 여백(탭 막대 자리)이 내용 뒤에 붙지 않아 마지막 줄이 탭 막대 뒤에 갇혔다 —
                휴대폰은 내용만큼 늘어나게(min-h-full) 한다(11/21). */}
            <div className="h-full w-full px-4 py-4 max-md:h-auto max-md:min-h-full sm:px-5 md:px-6 md:py-5">
              <ContentWidth>{children}</ContentWidth>
            </div>
          </main>
        </div>
        <MobileBottomNav username={viewerUsername} bookingsBadge={bookingsBadge} />
      </div>
    </MobileMenuProvider>
  );
}
