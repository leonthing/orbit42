import type { Metadata } from "next";
import { listMySlots, getUpcomingAvailabilities } from "@/lib/slots";
import { listMyCalendars } from "@/lib/calendars";
import { listMyMenus, listMenusForSlot } from "@/lib/menus";
import { listLocationBuffers } from "@/lib/location-buffers";
import { isGoogleCalendarConnected } from "../calendar/actions";
import SlotsManager from "./SlotsManager";
import { getUserId } from "@/lib/db";
import { getAdminClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "예약 링크" };
export const dynamic = "force-dynamic";

export default async function SlotsPage({ params }: { params: { username: string } }) {
  const [slots, myCalendars, myMenus, locationPresets, googleConnected] =
    await Promise.all([
      listMySlots(),
      listMyCalendars().catch(() => []),
      listMyMenus().catch(() => []),
      listLocationBuffers().catch(() => []),
      isGoogleCalendarConnected().catch(() => false),
    ]);
  const withAvail = await Promise.all(
    slots.map(async (s) => ({
      slot: s,
      availabilities: await getUpcomingAvailabilities(s.id),
      menuIds: (await listMenusForSlot(s.id)).map((m) => m.id),
    })),
  );

  const userId = await getUserId();
  const { data: payRow } = userId
    ? await getAdminClient().from("users").select("payment_instructions").eq("id", userId).single()
    : { data: null };
  const hasPaymentInstructions = !!(payRow as { payment_instructions: string | null } | null)?.payment_instructions;

  return (
    <SlotsManager
      username={params.username}
      initial={withAvail}
      myCalendars={myCalendars}
      myMenus={myMenus}
      locationPresets={locationPresets.map((p) => p.name)}
      googleConnected={googleConnected}
      hasPaymentInstructions={hasPaymentInstructions}
    />
  );
}
