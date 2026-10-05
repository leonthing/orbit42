"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

/** 계좌이체 안내 저장 — 비우면 유료 슬롯 예약이 다시 '호스트 안내에 따라 결제'로 돌아간다. */
export async function updatePaymentInstructions(text: string) {
  const userId = await requireUserId();
  const v = text.trim().slice(0, 500) || null;
  const { error } = await getAdminClient()
    .from("users")
    .update({ payment_instructions: v, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: "저장에 실패했어요." };
  return { success: true as const };
}
