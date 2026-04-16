"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import type { NotificationPref } from "@/lib/notification-prefs-types";
export type { NotificationPref } from "@/lib/notification-prefs-types";

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

export async function getMyPrefs(): Promise<Record<string, NotificationPref>> {
  const me = await currentUserId();
  if (!me) return {};
  const db = getAdminClient();
  const { data } = await db
    .from("notification_prefs")
    .select("type, in_app, email")
    .eq("user_id", me);
  const out: Record<string, NotificationPref> = {};
  for (const r of data ?? []) {
    out[r.type as string] = {
      type: r.type as string,
      in_app: (r.in_app as boolean) ?? true,
      email: (r.email as boolean) ?? true,
    };
  }
  return out;
}

/** Returns effective pref for a given (user, type), defaulting on when no row. */
export async function getPrefFor(
  userId: string,
  type: string,
): Promise<NotificationPref> {
  const db = getAdminClient();
  const { data } = await db
    .from("notification_prefs")
    .select("in_app, email")
    .eq("user_id", userId)
    .eq("type", type)
    .maybeSingle();
  return {
    type,
    in_app: (data?.in_app as boolean | undefined) ?? true,
    email: (data?.email as boolean | undefined) ?? true,
  };
}

export async function setPref(
  type: string,
  channel: "in_app" | "email",
  enabled: boolean,
) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요해요." };
  const db = getAdminClient();
  await db
    .from("notification_prefs")
    .upsert(
      {
        user_id: me,
        type,
        [channel]: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,type" },
    );
  revalidatePath("/", "layout");
  return { ok: true as const };
}
