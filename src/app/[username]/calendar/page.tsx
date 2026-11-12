import Link from "next/link";
import type { Metadata } from "next";
import { getEvents, isGoogleCalendarConnected } from "./actions";
import { getProfile, getSession } from "@/lib/auth";
import { getLifeMemories } from "./life-actions";
import type { LifeMemory } from "./life-actions";
import { getProfileWeek, startOfWeek } from "@/lib/profile-week";
import { listMyCalendars } from "@/lib/calendars";
import CalendarView from "./CalendarView";
import { SlotPanelProvider } from "@/components/SlotPanel";
import { OnboardingSection } from "@/components/OnboardingSection";
import { getUserId } from "@/lib/db";
import { getAdminClient } from "@/lib/supabase";
import { normalizeWeekStart } from "@/lib/week-start";

export const metadata: Metadata = { title: "캘린더" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({
  params,
}: {
  params: { username: string };
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  // 보는 사람의 주 시작 요일 설정 (월/일)
  const viewerId = await getUserId().catch(() => null);
  const { data: wsRow } = viewerId
    ? await getAdminClient().from("users").select("week_start").eq("id", viewerId).single()
    : { data: null };
  const weekStartPref = normalizeWeekStart((wsRow as { week_start?: string } | null)?.week_start);
  const weekStart = startOfWeek(new Date(), weekStartPref);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);

  const [googleConnected, profile, lifeMemories, session] =
    await Promise.all([
      isGoogleCalendarConnected().catch(() => false),
      getProfile(params.username).catch(() => null),
      getLifeMemories().catch(() => [] as LifeMemory[]),
      getSession().catch(() => null),
    ]);

  const myCalendars = await listMyCalendars().catch(() => []);

  // Default selection: all of the user's calendars. Users almost always
  // want to see everything when they land on the page; they can deselect
  // anything they don't want via the picker.
  const defaultSelection = myCalendars.map((c) => c.id);

  const [events, weekDays] = await Promise.all([
    getEvents(year, month, defaultSelection).catch(() => []),
    getProfileWeek(
      params.username,
      weekStart,
      weekEnd,
      defaultSelection.length > 0 ? defaultSelection : undefined,
    ).catch(() => []),
  ]);

  const birthDate = profile?.birth_date || null;
  const isOwner = session?.username === params.username;
  // 할 일(1.9.0): 오늘 기한 + 기한 지난 미완료가 있으면 위에 링크 한 줄
  let todoCount = 0;
  if (isOwner && session) {
    const [{ userIdOf }, { todoCountForMorning }] = await Promise.all([import("@/lib/dm"), import("@/lib/todos")]);
    const me = await userIdOf(session.username);
    // todoCountForMorning 이 v190OpenFor(me)로 시행 전·미리보기를 가린다
    if (me) todoCount = await todoCountForMorning(me).catch(() => 0);
  }

  return (
    <SlotPanelProvider username={params.username}>
      {/* 체크리스트와 캘린더를 한 flex 컬럼에 둔다. 캘린더에 h-full 을 주면
          체크리스트 높이를 무시하고 화면 전체를 차지해 아래로 넘친다. */}
      <div className="flex h-full flex-col gap-4">
        {/* 홈이 캘린더로 옮겨오면서 시작하기 체크리스트도 함께 이주했다.
            내 캘린더일 때만 보여준다 (남의 캘린더에서는 의미 없음). */}
        {isOwner && <OnboardingSection />}
        {todoCount > 0 && (
          <Link href={`/${params.username}/todos`} className="self-start rounded-lg border border-charcoal-800/60 px-3 py-1.5 text-xs text-charcoal-300 hover:text-charcoal-100">
            할 일 {todoCount} →
          </Link>
        )}
        <CalendarView
          username={params.username}
          initialEvents={events}
          initialYear={year}
          initialMonth={month}
          googleConnected={googleConnected}
          birthDate={birthDate}
          initialMemories={lifeMemories}
          initialWeekDays={weekDays}
          initialSelectedCalendars={defaultSelection}
          myCalendars={isOwner ? myCalendars : []}
          viewerIsOwner={isOwner}
          weekStart={weekStartPref}
        />
      </div>
    </SlotPanelProvider>
  );
}
