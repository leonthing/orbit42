import { getAdminClient } from "@/lib/supabase";
import { getSession, getProfile } from "@/lib/auth";
import { listFollowing } from "@/lib/follows";
import { isGoogleCalendarConnected } from "@/app/[username]/calendar/actions";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

/**
 * "시작하기" 체크리스트를 스스로 조회해 그리는 서버 컴포넌트.
 *
 * 원래 피드 페이지의 데이터 페칭에 얽혀 있었는데, 홈이 캘린더로 옮겨가면서
 * 어느 화면에서든 붙일 수 있도록 분리했다. 모든 단계가 끝나면 컴포넌트가
 * 스스로 사라지므로(내부 OnboardingChecklist) 호출부는 조건을 몰라도 된다.
 */
export async function OnboardingSection() {
  const session = await getSession();
  if (!session) return null;

  const [following, viewerProfile, googleConnected] = await Promise.all([
    listFollowing(session.username),
    getProfile(session.username),
    isGoogleCalendarConnected().catch(() => false),
  ]);

  const db = getAdminClient();
  const { data: viewerRow } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  const viewerId = viewerRow?.id as string | undefined;

  // 가벼운 head-count 만 — 카드는 다 끝나면 스스로 숨는다.
  const [slotCountRes, blogCountRes, feedPostCountRes] = viewerId
    ? await Promise.all([
        db
          .from("time_slots")
          .select("id", { count: "exact", head: true })
          .eq("host_id", viewerId),
        db
          .from("blog_posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", viewerId),
        db
          .from("feed_posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", viewerId),
      ])
    : [null, null, null];

  const steps = [
    {
      key: "profile",
      label: "프로필 사진과 소개 채우기",
      href: `/${session.username}/settings#profile`,
      done: !!viewerProfile?.avatar_url && !!viewerProfile?.bio,
    },
    {
      key: "google",
      label: "구글 캘린더 연결하기",
      href: `/${session.username}/settings#google`,
      done: googleConnected,
    },
    {
      key: "slot",
      label: "첫 타임슬롯 열기",
      href: `/${session.username}/slots`,
      done: (slotCountRes?.count ?? 0) > 0,
    },
    {
      key: "follow",
      label: "관심 있는 사람 팔로우하기",
      href: "/explore",
      done: following.length > 0,
    },
    {
      key: "write",
      label: "첫 소식이나 글 남기기",
      href: `/${session.username}/blog`,
      done:
        (blogCountRes?.count ?? 0) > 0 || (feedPostCountRes?.count ?? 0) > 0,
    },
  ];

  return <OnboardingChecklist steps={steps} />;
}
