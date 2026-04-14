"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId, getUserId } from "@/lib/db";
import { getAuthenticatedCalendar } from "@/lib/google";
import type {
  CalendarVisibility,
  CalendarPurpose,
  CalendarSetting,
} from "@/lib/calendar-settings-types";

export type { CalendarVisibility, CalendarPurpose, CalendarSetting };

export async function getCalendarSettings(): Promise<CalendarSetting[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("user_calendar_settings")
    .select("google_calendar_id, visibility, label_override, purpose, color_override")
    .eq("user_id", userId);
  return (data ?? []) as CalendarSetting[];
}

export async function setCalendarPurpose(
  googleCalendarId: string,
  purpose: CalendarPurpose | null,
  labelOverride?: string | null,
  colorOverride?: string | null,
) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const patch: Record<string, unknown> = {
    user_id: userId,
    google_calendar_id: googleCalendarId,
    purpose,
    updated_at: new Date().toISOString(),
  };
  if (labelOverride !== undefined) patch.label_override = labelOverride;
  if (colorOverride !== undefined) patch.color_override = colorOverride;
  const { error } = await db
    .from("user_calendar_settings")
    .upsert(patch, { onConflict: "user_id,google_calendar_id" });
  if (error) return { error: "저장에 실패했습니다." };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function createGoogleCalendar(args: {
  name: string;
  purpose: CalendarPurpose;
  color?: string;
  visibility?: CalendarVisibility;
}) {
  const userId = await requireUserId();
  if (!args.name.trim()) return { error: "이름을 입력해주세요." };

  const calendar = await getAuthenticatedCalendar(userId);
  if (!calendar) return { error: "Google Calendar를 먼저 연결해주세요." };

  let calendarId: string;
  try {
    const res = await calendar.calendars.insert({
      requestBody: {
        summary: args.name.trim(),
        timeZone: "Asia/Seoul",
      },
    });
    calendarId = res.data.id || "";
    if (!calendarId) throw new Error("no calendar id");
  } catch (err) {
    console.error("calendars.insert", err);
    return { error: "Google 캘린더 생성에 실패했습니다." };
  }

  const db = getAdminClient();
  const { error } = await db.from("user_calendar_settings").insert({
    user_id: userId,
    google_calendar_id: calendarId,
    visibility: args.visibility ?? "private",
    purpose: args.purpose,
    label_override: args.name.trim(),
    color_override: args.color ?? null,
  });
  if (error) {
    console.error("user_calendar_settings.insert", error);
    return { error: "설정 저장에 실패했습니다." };
  }

  revalidatePath("/", "layout");
  return { success: true, calendarId };
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
    .select("google_calendar_id, visibility, label_override, purpose, color_override")
    .eq("user_id", user.id)
    .in("visibility", allowed);

  return (data ?? []) as CalendarSetting[];
}
