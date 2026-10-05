"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

/** 캘린더 주 시작 요일 저장 (월/일) */
export async function updateWeekStart(value: string) {
  const userId = await requireUserId();
  if (value !== "mon" && value !== "sun") return { error: "알 수 없는 값이에요." };
  const { error } = await getAdminClient()
    .from("users")
    .update({ week_start: value, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: "저장에 실패했어요." };
  revalidatePath("/", "layout");
  return { success: true as const };
}
