"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export type NativeEvent = {
  id: string;
  calendar_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
};

export type NativeEventWithCalendar = NativeEvent & {
  calendar_color: string;
  calendar_label: string;
};

export async function createNativeEvent(args: {
  calendar_id: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean;
}) {
  const userId = await requireUserId();
  if (!args.title.trim()) return { error: "제목을 입력해주세요." };

  const db = getAdminClient();
  // Make sure the calendar belongs to the user
  const { data: cal } = await db
    .from("calendars")
    .select("id, user_id")
    .eq("id", args.calendar_id)
    .single();
  if (!cal || cal.user_id !== userId) return { error: "권한이 없습니다." };

  const { error } = await db.from("events").insert({
    user_id: userId,
    calendar_id: args.calendar_id,
    title: args.title.trim(),
    description: args.description ?? null,
    start_at: args.start_at,
    end_at: args.end_at ?? null,
    all_day: args.all_day ?? false,
  });
  if (error) {
    console.error("createNativeEvent", error);
    return { error: "등록에 실패했습니다." };
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteNativeEvent(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db
    .from("events")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "삭제 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

/** Events on any of the given calendars within the range. */
export async function listNativeEventsInCalendars(
  calendarIds: string[],
  rangeStart: Date,
  rangeEnd: Date,
): Promise<NativeEventWithCalendar[]> {
  if (calendarIds.length === 0) return [];
  const db = getAdminClient();
  const { data } = await db
    .from(
      "events",
    )
    .select(
      "id, calendar_id, title, description, start_at, end_at, all_day, calendar:calendars!events_calendar_id_fkey(name, color)",
    )
    .in("calendar_id", calendarIds)
    .gte("start_at", rangeStart.toISOString())
    .lte("start_at", rangeEnd.toISOString())
    .order("start_at", { ascending: true });

  return ((data ?? []) as unknown[] as Array<{
    id: string;
    calendar_id: string | null;
    title: string;
    description: string | null;
    start_at: string;
    end_at: string | null;
    all_day: boolean;
    calendar: { name: string; color: string } | null;
  }>).map((r) => ({
    id: r.id,
    calendar_id: r.calendar_id,
    title: r.title,
    description: r.description,
    start_at: r.start_at,
    end_at: r.end_at ?? r.start_at,
    all_day: r.all_day,
    calendar_color: r.calendar?.color ?? "#6366f1",
    calendar_label: r.calendar?.name ?? "내 캘린더",
  }));
}
