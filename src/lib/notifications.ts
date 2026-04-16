"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import type { AppNotification, NotificationType } from "@/lib/notifications-types";

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

/**
 * Create a notification row for a recipient. Safe to call from any
 * server action; failures are logged, never thrown, so the calling
 * action still succeeds even if notification insert fails.
 */
export async function createNotification(args: {
  userId: string;
  type: NotificationType | string;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
}) {
  try {
    const db = getAdminClient();
    await db.from("notifications").insert({
      user_id: args.userId,
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
      actor_id: args.actorId ?? null,
    });
  } catch (err) {
    console.error("createNotification", err);
  }
}

export async function listNotifications(
  limit = 30,
): Promise<AppNotification[]> {
  const me = await currentUserId();
  if (!me) return [];
  const db = getAdminClient();
  const { data } = await db
    .from("notifications")
    .select("id, type, title, body, link, actor_id, read_at, created_at")
    .eq("user_id", me)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data) return [];

  const actorIds = Array.from(
    new Set(
      data
        .map((n) => n.actor_id as string | null)
        .filter((v): v is string => !!v),
    ),
  );
  const actorMap = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  >();
  if (actorIds.length > 0) {
    const { data: actors } = await db
      .from("users")
      .select("id, username, display_name, avatar_url")
      .in("id", actorIds);
    for (const a of actors ?? []) {
      actorMap.set(a.id as string, {
        username: a.username as string,
        display_name: (a.display_name as string | null) ?? null,
        avatar_url: (a.avatar_url as string | null) ?? null,
      });
    }
  }

  return data.map((n) => ({
    id: n.id as string,
    type: n.type as string,
    title: n.title as string,
    body: (n.body as string | null) ?? null,
    link: (n.link as string | null) ?? null,
    actor: n.actor_id ? actorMap.get(n.actor_id as string) ?? null : null,
    read_at: (n.read_at as string | null) ?? null,
    created_at: n.created_at as string,
  }));
}

export async function unreadNotificationCount(): Promise<number> {
  const me = await currentUserId();
  if (!me) return 0;
  const db = getAdminClient();
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me)
    .is("read_at", null);
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요해요." };
  const db = getAdminClient();
  await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", me)
    .is("read_at", null);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요해요." };
  const db = getAdminClient();
  await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", me)
    .is("read_at", null);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
