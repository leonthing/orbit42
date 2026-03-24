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

  let events: Awaited<ReturnType<typeof getEvents>> = [];
  let googleConnected = false;
  let googleCalendars: GoogleCalendarInfo[] = [];
  let birthDate: string | null = null;
  let lifeMemories: LifeMemory[] = [];

  try {
    const [evts, gc, gcals, profile, memories] = await Promise.all([
      getEvents(year, month),
      isGoogleCalendarConnected(),
      getGoogleCalendars(),
      getProfile(params.username),
      getLifeMemories().catch(() => [] as LifeMemory[]),
    ]);
    events = evts;
    googleConnected = gc;
    googleCalendars = gcals;
    birthDate = profile?.birth_date || null;
    lifeMemories = memories;
  } catch {
    // User not authenticated
  }

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
