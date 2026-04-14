import type { Metadata } from "next";
import { listMySlots, getUpcomingAvailabilities } from "@/lib/slots";
import SlotsManager from "./SlotsManager";

export const metadata: Metadata = { title: "Slots" };
export const dynamic = "force-dynamic";

export default async function SlotsPage({ params }: { params: { username: string } }) {
  const slots = await listMySlots();
  const withAvail = await Promise.all(
    slots.map(async (s) => ({
      slot: s,
      availabilities: await getUpcomingAvailabilities(s.id),
    })),
  );

  return <SlotsManager username={params.username} initial={withAvail} />;
}
