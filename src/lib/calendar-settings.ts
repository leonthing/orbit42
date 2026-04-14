"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId, getUserId } from "@/lib/db";

export type CalendarVisibility = "private" | "followers" | "public";

export type CalendarSetting = {
  google_calendar_id: string;
  visibility: CalendarVisibility;
  label_override: string | null;
};

export async function getCalendarSettings(): Promise<CalendarSetting[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("user_calendar_settings")
    .select("google_calendar_id, visibility, label_override")
    .eq("user_id", userId);
  return (data ?? []) as CalendarSetting[];
}

export async function setCalendarVisibility(
  googleCalendarId: string,
  visibility: CalendarVisibility,
) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("user_calendar_settings")
    .upsert(
      {
        user_id: userId,
        google_calendar_id: googleCalendarId,
        visibility,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,google_calendar_id" },
    );

  if (error) return { error: "저장에 실패했습니다." };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function getPublicCalendarSettingsByUsername(username: string) {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (!user) return [] as CalendarSetting[];

  const viewerId = await getUserId();
  const allowed: CalendarVisibility[] = viewerId
    ? ["public", "followers"]
    : ["public"];

  const { data } = await db
    .from("user_calendar_settings")
    .select("google_calendar_id, visibility, label_override")
    .eq("user_id", user.id)
    .in("visibility", allowed);

  return (data ?? []) as CalendarSetting[];
}
