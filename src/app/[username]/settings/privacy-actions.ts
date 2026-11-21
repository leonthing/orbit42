"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

/**
 * 프로필 비공개 켜기/끄기 — 세션 사용자 본인의 is_private 한 칸만(iOS PATCH /api/v1/me {isPrivate} 와 같은 동작).
 * 검색·프로필 조회·남의 오르빗에서 숨겨지고, 직접 공유한 예약 링크는 계속 동작한다.
 */
export async function setProfilePrivate(isPrivate: boolean) {
  if (typeof isPrivate !== "boolean") return { error: "값이 올바르지 않아요." };
  const userId = await requireUserId();
  const { error } = await getAdminClient()
    .from("users")
    .update({ is_private: isPrivate, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: "저장에 실패했어요." };
  revalidatePath("/", "layout");
  return { success: true as const, isPrivate };
}
