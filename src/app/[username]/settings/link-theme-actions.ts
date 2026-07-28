"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import { LINK_THEMES } from "@/lib/link-themes";

/** 공개 프로필 테마 저장 — 알 수 없는 키는 거부한다. */
export async function updateLinkTheme(key: string) {
  const userId = await requireUserId();
  if (!LINK_THEMES.some((t) => t.key === key)) {
    return { error: "알 수 없는 테마예요." };
  }
  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({ link_theme: key, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: "저장에 실패했어요." };
  revalidatePath("/", "layout");
  return { success: true as const };
}
