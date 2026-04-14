"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { getUserId } from "@/lib/db";
import {
  REACTION_EMOJIS,
  type ReactionTarget,
  type ReactionSummary,
} from "@/lib/reactions-types";

export async function toggleReaction(
  target_type: ReactionTarget,
  target_id: string,
  emoji: string,
) {
  const userId = await getUserId();
  if (!userId) return { error: "로그인이 필요합니다." };
  if (!REACTION_EMOJIS.includes(emoji as (typeof REACTION_EMOJIS)[number])) {
    return { error: "지원하지 않는 이모지입니다." };
  }

  const db = getAdminClient();
  const { data: existing } = await db
    .from("reactions")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await db.from("reactions").delete().eq("id", existing.id);
  } else {
    await db.from("reactions").insert({
      user_id: userId,
      target_type,
      target_id,
      emoji,
    });
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function getReactionsFor(
  target_type: ReactionTarget,
  target_id: string,
): Promise<ReactionSummary[]> {
  return (await getReactionsForMany(target_type, [target_id])).get(target_id) ?? [];
}

export async function getReactionsForMany(
  target_type: ReactionTarget,
  target_ids: string[],
): Promise<Map<string, ReactionSummary[]>> {
  const out = new Map<string, ReactionSummary[]>();
  if (target_ids.length === 0) return out;

  const db = getAdminClient();
  const viewerId = await getUserId();

  const { data } = await db
    .from("reactions")
    .select("target_id, emoji, user_id")
    .eq("target_type", target_type)
    .in("target_id", target_ids);

  const rows = (data ?? []) as { target_id: string; emoji: string; user_id: string }[];
  const grouped: Record<string, Record<string, { count: number; by_me: boolean }>> = {};
  for (const r of rows) {
    grouped[r.target_id] ||= {};
    const e = (grouped[r.target_id][r.emoji] ||= { count: 0, by_me: false });
    e.count += 1;
    if (viewerId && r.user_id === viewerId) e.by_me = true;
  }

  for (const id of target_ids) {
    const m = grouped[id] ?? {};
    out.set(
      id,
      REACTION_EMOJIS.filter((e) => m[e]).map((e) => ({
        emoji: e,
        count: m[e].count,
        by_me: m[e].by_me,
      })),
    );
  }
  return out;
}
