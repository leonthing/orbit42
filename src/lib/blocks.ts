"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";

async function resolve(username: string): Promise<string | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function meId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  return await resolve(session.username);
}

export async function blockUser(targetUsername: string) {
  const me = await meId();
  if (!me) return { error: "로그인이 필요해요." };
  const target = await resolve(targetUsername);
  if (!target) return { error: "사용자를 찾을 수 없어요." };
  if (me === target) return { error: "자기 자신은 차단할 수 없어요." };

  const db = getAdminClient();
  // Block: insert (upsert on conflict do nothing).
  await db
    .from("user_blocks")
    .upsert(
      { blocker_id: me, blocked_id: target },
      { onConflict: "blocker_id,blocked_id" },
    );
  // Remove any existing follow relationship in either direction.
  await db.from("follows").delete().match({
    follower_id: me,
    following_id: target,
  });
  await db.from("follows").delete().match({
    follower_id: target,
    following_id: me,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function unblockUser(targetUsername: string) {
  const me = await meId();
  if (!me) return { error: "로그인이 필요해요." };
  const target = await resolve(targetUsername);
  if (!target) return { error: "사용자를 찾을 수 없어요." };
  const db = getAdminClient();
  await db
    .from("user_blocks")
    .delete()
    .eq("blocker_id", me)
    .eq("blocked_id", target);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function isBlocked(targetUsername: string): Promise<boolean> {
  const me = await meId();
  if (!me) return false;
  const target = await resolve(targetUsername);
  if (!target) return false;
  const db = getAdminClient();
  const { data } = await db
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocker_id", me)
    .eq("blocked_id", target)
    .maybeSingle();
  return !!data;
}

/** Either direction: true if me blocked them OR they blocked me. */
export async function isBlockedEitherWay(
  myId: string,
  otherId: string,
): Promise<boolean> {
  const db = getAdminClient();
  const { data } = await db
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${myId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${myId})`,
    )
    .limit(1)
    .maybeSingle();
  return !!data;
}
