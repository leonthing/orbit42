import type { Metadata } from "next";
import { getEvents, isGoogleCalendarConnected, getGoogleCalendars } from "./actions";
import type { GoogleCalendarInfo } from "./actions";
import { getProfile } from "@/lib/auth";
import { getLifeMemories } from "./life-actions";
import type { LifeMemory } from "./life-actions";
import CalendarView from "./CalendarView";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({
  params,
}: {
  params: { username: string };
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const [events, googleConnected, googleCalendars, profile, lifeMemories] =
    await Promise.all([
      getEvents(year, month).catch(() => []),
      isGoogleCalendarConnected().catch(() => false),
      getGoogleCalendars().catch(() => [] as GoogleCalendarInfo[]),
      getProfile(params.username).catch(() => null),
      getLifeMemories().catch(() => [] as LifeMemory[]),
    ]);

  const birthDate = profile?.birth_date || null;

  return (
    <CalendarView
      initialEvents={events}
      initialYear={year}
      initialMonth={month}
      googleConnected={googleConnected}
      googleCalendars={googleCalendars}
      birthDate={birthDate}
      initialMemories={lifeMemories}
    />
  );
}
