import type { Metadata } from "next";
import { listMySlots, getUpcomingAvailabilities } from "@/lib/slots";
import { listMyCalendars } from "@/lib/calendars";
import { listMyMenus, listMenusForSlot } from "@/lib/menus";
import { listLocationBuffers } from "@/lib/location-buffers";
import SlotsManager from "./SlotsManager";

export const metadata: Metadata = { title: "타임슬롯" };
export const dynamic = "force-dynamic";

export default async function SlotsPage({ params }: { params: { username: string } }) {
  const [slots, myCalendars, myMenus, locationPresets] = await Promise.all([
    listMySlots(),
    listMyCalendars().catch(() => []),
    listMyMenus().catch(() => []),
    listLocationBuffers().catch(() => []),
  ]);
  const withAvail = await Promise.all(
    slots.map(async (s) => ({
      slot: s,
      availabilities: await getUpcomingAvailabilities(s.id),
      menuIds: (await listMenusForSlot(s.id)).map((m) => m.id),
    })),
  );

  return (
    <SlotsManager
      username={params.username}
      initial={withAvail}
      myCalendars={myCalendars}
      myMenus={myMenus}
      locationPresets={locationPresets.map((p) => p.name)}
    />
  );
}
