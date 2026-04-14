"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export type Bid = {
  id: string;
  slot_id: string;
  bidder_id: string;
  amount_cents: number;
  created_at: string;
  bidder?: { username: string; display_name: string | null } | null;
};

const MIN_INCREMENT = 100; // ₩1 in cents

export async function placeBid(slotId: string, amountCents: number) {
  const userId = await requireUserId();
  if (amountCents <= 0) return { error: "잘못된 금액입니다." };

  const db = getAdminClient();

  const { data: slot } = await db
    .from("time_slots")
    .select(
      "id, host_id, pricing_model, reserve_price_cents, auction_ends_at, current_high_bid_cents, active",
    )
    .eq("id", slotId)
    .single();
  if (!slot) return { error: "슬롯을 찾을 수 없습니다." };
  if (slot.pricing_model !== "auction") return { error: "경매 슬롯이 아닙니다." };
  if (!slot.active) return { error: "비활성 슬롯입니다." };
  if (slot.host_id === userId) return { error: "본인 슬롯에는 입찰할 수 없어요." };

  if (slot.auction_ends_at && new Date(slot.auction_ends_at as string) < new Date()) {
    return { error: "경매가 종료되었습니다." };
  }

  const reserve = (slot.reserve_price_cents as number | null) ?? 0;
  const high = (slot.current_high_bid_cents as number | null) ?? 0;
  const minNext = high > 0 ? high + MIN_INCREMENT : Math.max(reserve, MIN_INCREMENT);
  if (amountCents < minNext) {
    return {
      error: `입찰가는 최소 ₩${(minNext / 100).toLocaleString("ko-KR")} 이상이어야 합니다.`,
    };
  }

  const { error: bidErr } = await db.from("bids").insert({
    slot_id: slotId,
    bidder_id: userId,
    amount_cents: amountCents,
  });
  if (bidErr) return { error: "입찰에 실패했습니다." };

  await db
    .from("time_slots")
    .update({
      current_high_bid_cents: amountCents,
      current_high_bidder_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", slotId);

  revalidatePath("/", "layout");
  return { success: true };
}

export async function listBids(slotId: string, limit = 20): Promise<Bid[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("bids")
    .select(
      "id, slot_id, bidder_id, amount_cents, created_at, bidder:users!bids_bidder_id_fkey(username, display_name)",
    )
    .eq("slot_id", slotId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown) as Bid[];
}
