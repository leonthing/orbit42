"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId, getUserId } from "@/lib/db";
import {
  getAuthenticatedCalendar,
  listExtraGoogleAccounts,
  getCalendarForExtraAccount,
} from "@/lib/google";
import type {
  Calendar,
  CalendarPurpose,
  CalendarVisibility,
} from "@/lib/calendars-types";

export type { Calendar };

export async function listMyCalendars(): Promise<Calendar[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("calendars")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  const owned = (data ?? []) as Calendar[];

  // 공유받은 캘린더를 뒤에 붙인다 (sharedRole/sharedBy 로 표시 구분).
  const { sharedCalendarsFor } = await import("@/lib/calendar-members");
  const shared = await sharedCalendarsFor(userId);
  if (shared.size === 0) return owned;

  const { data: sharedRows } = await db
    .from("calendars")
    .select("*")
    .in("id", Array.from(shared.keys()))
    .order("created_at", { ascending: true });
  const sharedCals = (sharedRows ?? []).map((c) => {
    const meta = shared.get(c.id as string);
    return {
      ...(c as Calendar),
      shared_role: meta?.role ?? "viewer",
      shared_by_username: meta?.ownerUsername ?? null,
      shared_by_name: meta?.ownerName ?? null,
    } as Calendar;
  });
  return [...owned, ...sharedCals];
}

export async function createNativeCalendar(args: {
  name: string;
  purpose: CalendarPurpose;
  color: string;
  visibility?: CalendarVisibility;
  goalTitle?: string | null;
  goalTargetHours?: number | null;
  goalDeadline?: string | null;
}) {
  const userId = await requireUserId();
  if (!args.name.trim()) return { error: "이름을 입력해주세요." };

  const db = getAdminClient();
  const hasGoal =
    !!args.goalTitle || args.goalTargetHours != null || !!args.goalDeadline;
  const { error } = await db.from("calendars").insert({
    user_id: userId,
    name: args.name.trim(),
    purpose: args.purpose,
    color: args.color,
    visibility: args.visibility ?? "private",
    source: "native",
    goal_title: args.goalTitle?.trim() || null,
    goal_target_hours: args.goalTargetHours ?? null,
    goal_deadline: args.goalDeadline ?? null,
    // 목표가 설정된 채로 만들어지면 그 순간부터 집계 시작.
    goal_started_at: hasGoal ? new Date().toISOString() : null,
  });
  if (error) {
    console.error("createNativeCalendar", error);
    return { error: "생성에 실패했습니다." };
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function createGoogleLinkedCalendar(args: {
  name: string;
  purpose: CalendarPurpose;
  color: string;
  visibility?: CalendarVisibility;
}) {
  const userId = await requireUserId();
  if (!args.name.trim()) return { error: "이름을 입력해주세요." };

  const calendar = await getAuthenticatedCalendar(userId);
  if (!calendar) return { error: "Google Calendar를 먼저 연결해주세요." };

  let calendarId: string;
  try {
    const res = await calendar.calendars.insert({
      requestBody: { summary: args.name.trim(), timeZone: "Asia/Seoul" },
    });
    calendarId = res.data.id || "";
    if (!calendarId) throw new Error("no calendar id");
  } catch (err) {
    console.error("calendars.insert", err);
    return { error: "Google 캘린더 생성에 실패했습니다." };
  }

  const db = getAdminClient();
  const { error } = await db.from("calendars").insert({
    user_id: userId,
    name: args.name.trim(),
    purpose: args.purpose,
    color: args.color,
    visibility: args.visibility ?? "private",
    source: "google",
    google_calendar_id: calendarId,
  });
  if (error) {
    console.error("calendars insert", error);
    return { error: "설정 저장에 실패했습니다." };
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateCalendar(
  id: string,
  patch: Partial<
    Pick<Calendar, "name" | "purpose" | "color" | "visibility" | "hourly_rate_krw">
  >,
) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db
    .from("calendars")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "수정 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteCalendar(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data: cal } = await db
    .from("calendars")
    .select("is_default")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (cal?.is_default) return { error: "기본 캘린더는 삭제할 수 없어요." };

  const { error } = await db
    .from("calendars")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "삭제 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

/** Given a viewer/host relation, return which calendars are visible. */
export async function listVisibleCalendars(
  hostUsername: string,
): Promise<Calendar[]> {
  const db = getAdminClient();
  const { data: host } = await db
    .from("users")
    .select("id")
    .eq("username", hostUsername)
    .single();
  if (!host) return [];

  const viewerId = await getUserId();
  const isOwner = await (async () => {
    if (!viewerId) return false;
    return viewerId === host.id;
  })();

  let allowed: CalendarVisibility[] = ["public"];
  if (isOwner) allowed = ["public", "followers", "private"];
  else if (viewerId) {
    const { data: f } = await db
      .from("follows")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("following_id", host.id)
      .maybeSingle();
    if (f) allowed = ["public", "followers"];
  }

  const { data } = await db
    .from("calendars")
    .select("*")
    .eq("user_id", host.id)
    .in("visibility", allowed);
  return (data ?? []) as Calendar[];
}

/** For auto-slot availability and owner reads: all of the host's Google calendar fetchers. */
export async function getAllGoogleCalendarClients(userId: string) {
  const clients: Array<{ account_label: string; calendar: Awaited<ReturnType<typeof getAuthenticatedCalendar>> }> = [];
  const primary = await getAuthenticatedCalendar(userId);
  if (primary) clients.push({ account_label: "primary", calendar: primary });
  const extras = await listExtraGoogleAccounts(userId);
  for (const acc of extras) {
    const cal = await getCalendarForExtraAccount(acc);
    if (cal) clients.push({ account_label: acc.email ?? acc.id, calendar: cal });
  }
  return clients;
}
