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
    .in("event_key", keys);
  return (data ?? []).map((r) => r.event_key as string);
}

export async function toggleEventCompletion(eventKey: string, completed: boolean) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요합니다." };
  if (!eventKey) return { error: "잘못된 요청입니다." };
  const db = getAdminClient();
  if (completed) {
    const { error } = await db
      .from("event_completions")
      .upsert(
        { user_id: me, event_key: eventKey },
        { onConflict: "user_id,event_key" },
      );
    if (error) return { error: "저장에 실패했어요." };
  } else {
    const { error } = await db
      .from("event_completions")
      .delete()
      .eq("user_id", me)
      .eq("event_key", eventKey);
    if (error) return { error: "저장에 실패했어요." };
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}
