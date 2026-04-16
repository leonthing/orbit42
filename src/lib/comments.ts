"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export type CommentNode = {
  id: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  body: string;
  parent_id: string | null;
  created_at: string;
  replies: CommentNode[];
};

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

export async function listComments(
  targetType: "feed_post" | "blog_post",
  targetId: string,
): Promise<CommentNode[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("post_comments")
    .select("id, author_id, parent_id, body, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (!data || data.length === 0) return [];

  const authorIds = Array.from(new Set(data.map((c) => c.author_id as string)));
  const { data: authors } = await db
    .from("users")
    .select("id, username, display_name, avatar_url")
    .in("id", authorIds);
  const authorMap = new Map<
    string,
    {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    }
  >();
  for (const a of authors ?? []) {
    authorMap.set(a.id as string, {
      id: a.id as string,
      username: a.username as string,
      display_name: (a.display_name as string | null) ?? null,
      avatar_url: (a.avatar_url as string | null) ?? null,
    });
  }

  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const row of data) {
    const author = authorMap.get(row.author_id as string);
    if (!author) continue;
    const node: CommentNode = {
      id: row.id as string,
      author,
      body: row.body as string,
      parent_id: (row.parent_id as string | null) ?? null,
      created_at: row.created_at as string,
      replies: [],
    };
    byId.set(node.id, node);
  }
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export async function addComment(
  targetType: "feed_post" | "blog_post",
  targetId: string,
  body: string,
  parentId: string | null = null,
) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요해요." };
  const text = body.trim();
  if (!text) return { error: "내용을 입력해주세요." };
  if (text.length > 2000) return { error: "너무 길어요 (2000자 이하)." };

  const db = getAdminClient();
  const { data: created, error } = await db
    .from("post_comments")
    .insert({
      target_type: targetType,
      target_id: targetId,
      author_id: me,
      parent_id: parentId,
      body: text,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("addComment", error);
    return { error: "등록에 실패했어요." };
  }

  // Notify the relevant user(s).
  try {
    const preview = text.length > 120 ? text.slice(0, 120) : text;
    const { data: actor } = await db
      .from("users")
      .select("username, display_name")
      .eq("id", me)
      .single();
    const actorLabel =
      (actor?.display_name as string | null) ||
      (actor?.username as string) ||
      "누군가";

    if (parentId) {
      // Reply: notify parent comment's author.
      const { data: parent } = await db
        .from("post_comments")
        .select("author_id, target_type, target_id")
        .eq("id", parentId)
        .single();
      if (parent?.author_id && parent.author_id !== me) {
        await createNotification({
          userId: parent.author_id as string,
          type: "reply_received",
          title: `${actorLabel}님이 답글을 남겼어요`,
          body: preview,
          link: targetType === "feed_post" ? "/feed" : null,
          actorId: me,
        });
      }
    } else {
      // Root comment: notify the post's author.
      let authorId: string | null = null;
      if (targetType === "feed_post") {
        const { data: p } = await db
          .from("feed_posts")
          .select("author_id")
          .eq("id", targetId)
          .single();
        authorId = (p?.author_id as string | undefined) ?? null;
      } else {
        const { data: p } = await db
          .from("blog_posts")
          .select("author_id")
          .eq("slug", targetId)
          .maybeSingle();
        authorId = (p?.author_id as string | undefined) ?? null;
      }
      if (authorId && authorId !== me) {
        await createNotification({
          userId: authorId,
          type: "comment_received",
          title: `${actorLabel}님이 댓글을 남겼어요`,
          body: preview,
          link: targetType === "feed_post" ? "/feed" : null,
          actorId: me,
        });
      }
    }
  } catch (err) {
    console.error("comment notification", err);
  }

  revalidatePath("/feed");
  return { ok: true as const, id: created.id as string };
}

export async function deleteComment(id: string) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요해요." };
  const db = getAdminClient();
  const { error } = await db
    .from("post_comments")
    .delete()
    .eq("id", id)
    .eq("author_id", me);
  if (error) return { error: "삭제에 실패했어요." };
  revalidatePath("/feed");
  return { ok: true as const };
}
