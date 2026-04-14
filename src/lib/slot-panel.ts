"use server";

import { getSlotBySlug, getBookableOptions } from "@/lib/slots";
import type { BookableOption, TimeSlot } from "@/lib/slots";
import { getSession } from "@/lib/auth";
import { listMenusForSlot } from "@/lib/menus";
import type { Menu } from "@/lib/menus";

export type SlotPanelData = {
  slot: Pick<
    TimeSlot,
    | "id"
    | "slug"
    | "title"
    | "description"
    | "duration_min"
    | "price_cents"
    | "slot_type"
    | "location_detail"
    | "active"
    | "mode"
    | "pricing_model"
    | "reserve_price_cents"
  >;
  host: { username: string; display_name: string | null };
  options: BookableOption[];
  menus: Menu[];
  isAuction: boolean;
  isOwner: boolean;
  loggedIn: boolean;
};

export async function getSlotPanelData(
  username: string,
  slug: string,
): Promise<SlotPanelData | { error: string }> {
  const data = await getSlotBySlug(username, slug);
  if (!data) return { error: "슬롯을 찾을 수 없어요." };
  const { slot, host } = data;
  const session = await getSession();
  const isAuction = slot.pricing_model === "auction";
  const [options, menus] = await Promise.all([
    isAuction ? Promise.resolve([]) : getBookableOptions(slot),
    listMenusForSlot(slot.id),
  ]);
  return {
    slot: {
      id: slot.id,
      slug: slot.slug,
      title: slot.title,
      description: slot.description,
      duration_min: slot.duration_min,
      price_cents: slot.price_cents,
      slot_type: slot.slot_type,
      location_detail: slot.location_detail,
      active: slot.active,
      mode: slot.mode,
      pricing_model: slot.pricing_model,
      reserve_price_cents: slot.reserve_price_cents,
    },
    host,
    options,
    menus,
    isAuction,
    isOwner: session?.username === username,
    loggedIn: !!session,
  };
}
