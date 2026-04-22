import type { Metadata } from "next";
import { getEvents, isGoogleCalendarConnected } from "./actions";
import { getProfile, getSession } from "@/lib/auth";
import { getLifeMemories } from "./life-actions";
import type { LifeMemory } from "./life-actions";
import { getProfileWeek, startOfWeek } from "@/lib/profile-week";
import { listMyCalendars } from "@/lib/calendars";
import CalendarView from "./CalendarView";
import { SlotPanelProvider } from "@/components/SlotPanel";

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
  const weekStart = startOfWeek(new Date());
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

  return (
    <SlotPanelProvider username={params.username}>
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
      />
    </SlotPanelProvider>
  );
}
