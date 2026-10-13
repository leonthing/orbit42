"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";

async function currentUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  return (data?.id as string | undefined) ?? null;
}

/** Return the set of event keys the current user has marked complete among `keys`. */
export async function getCompletedKeys(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  const me = await currentUserId();
  if (!me) return [];
  const db = getAdminClient();
  const { data } = await db
    .from("event_completions")
    .select("event_key")
    .eq("user_id", me)
    .eq("status", "done")
    .in("event_key", keys);
  return (data ?? []).map((r) => r.event_key as string);
}

export async function toggleEventCompletion(eventKey: string, completed: boolean) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요합니다." };
  if (!eventKey) return { error: "잘못된 요청입니다." };
  const db = getAdminClient();
  if (completed) {
    // 보관한 일정을 완료로 체크하면 완료로 바뀐다 (상태는 하나).
    const { error } = await db
      .from("event_completions")
      .upsert(
        { user_id: me, event_key: eventKey, status: "done", completed_at: new Date().toISOString() },
        { onConflict: "user_id,event_key" },
      );
    if (error) return { error: "저장에 실패했어요." };
  } else {
    // 완료 해제는 완료 행만 지운다 — 보관은 그대로 둔다.
    const { error } = await db
      .from("event_completions")
      .delete()
      .eq("user_id", me)
      .eq("event_key", eventKey)
      .eq("status", "done");
    if (error) return { error: "저장에 실패했어요." };
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export type EventStatus = "done" | "archived";

/** 완료·보관 상태 지정 — "none" 은 상태를 지운다 (완료 해제·보관 해제 모두). */
export async function setEventStatus(eventKey: string, status: EventStatus | "none") {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요합니다." };
  if (!eventKey) return { error: "잘못된 요청입니다." };
  const db = getAdminClient();
  const { error } =
    status === "none"
      ? await db.from("event_completions").delete().eq("user_id", me).eq("event_key", eventKey)
      : await db
          .from("event_completions")
          .upsert(
            { user_id: me, event_key: eventKey, status, completed_at: new Date().toISOString() },
            { onConflict: "user_id,event_key" },
          );
  if (error) return { error: "저장에 실패했어요." };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** 키별 상태 (없으면 Map 에 없음). */
export async function getEventStatuses(keys: string[]): Promise<Record<string, EventStatus>> {
  if (keys.length === 0) return {};
  const me = await currentUserId();
  if (!me) return {};
  const db = getAdminClient();
  const out: Record<string, EventStatus> = {};
  const CHUNK = 200;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const { data } = await db
      .from("event_completions")
      .select("event_key, status")
      .eq("user_id", me)
      .in("event_key", keys.slice(i, i + CHUNK));
    for (const r of data ?? []) out[r.event_key as string] = r.status as EventStatus;
  }
  return out;
}
