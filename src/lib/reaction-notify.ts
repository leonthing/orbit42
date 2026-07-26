"use server";

import { getAdminClient } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import type { ReactionTarget } from "@/lib/reactions-types";

/**
 * Notify the target author when a new reaction lands. Best-effort;
 * errors are swallowed by the caller.
 */
export async function notifyReaction(
  actorId: string,
  targetType: ReactionTarget,
  targetId: string,
  emoji: string,
) {
  const db = getAdminClient();

  let authorId: string | null = null;
  let title = "";
  let link: string | null = null;

  if (targetType === "feed_post") {
    const { data } = await db
      .from("feed_posts")
      .select("user_id")
      .eq("id", targetId)
      .single();
    authorId = (data?.user_id as string | undefined) ?? null;
    link = "/feed";
  } else if (targetType === "comment") {
    const { data } = await db
      .from("post_comments")
      .select("author_id, target_type, target_id")
      .eq("id", targetId)
      .single();
    authorId = (data?.author_id as string | undefined) ?? null;
    if (data?.target_type === "blog_post") {
      // Guess a sane link — fall back to slug only.
      link = `/blog-public/${data?.target_id}`;
    } else {
      link = "/feed";
    }
  } else if (targetType === "post") {
    // Legacy blog posts: target_id is the slug. Resolve author later.
    const { data } = await db
      .from("blog_posts")
      .select("author_id, username, slug")
      .eq("slug", targetId)
      .single();
    authorId = (data?.author_id as string | undefined) ?? null;
    link = data
      ? `/blog-public/${data.username}/${data.slug}`
      : null;
  } else if (targetType === "slot") {
    const { data } = await db
      .from("time_slots")
      .select("host_id")
      .eq("id", targetId)
      .single();
    authorId = (data?.host_id as string | undefined) ?? null;
  }

  if (!authorId || authorId === actorId) return;

  const { data: actor } = await db
    .from("users")
    .select("username, display_name")
    .eq("id", actorId)
    .single();
  const label =
    (actor?.display_name as string | null) ||
    (actor?.username as string) ||
    "누군가";
  title = `${label}님이 ${emoji} 반응했어요`;

  await createNotification({
    userId: authorId,
    type: "reaction",
    title,
    body: null,
    link,
    actorId,
  });
}
