"use server";

import { supabase, getAdminClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export interface Comment {
  id: string;
  post_slug: string;
  author: string;
  content: string;
  parent_id: string | null;
  created_at: string;
}

export async function getComments(postSlug: string): Promise<Comment[]> {
  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("post_slug", postSlug)
    .order("created_at", { ascending: true });
  return data || [];
}

export async function addComment(
  postSlug: string,
  author: string,
  content: string,
  parentId?: string
) {
  if (!author.trim() || !content.trim()) {
    return { error: "이름과 내용을 입력해주세요." };
  }
  if (content.length > 2000) {
    return { error: "댓글은 2000자 이내로 작성해주세요." };
  }

  const { error } = await supabase.from("comments").insert({
    post_slug: postSlug,
    author: author.trim(),
    content: content.trim(),
    parent_id: parentId || null,
  });

  if (error) {
    return { error: "댓글 작성에 실패했습니다." };
  }
  return { success: true };
}

export async function deleteComment(commentId: string) {
  const isAdmin = cookies().get("admin_session")?.value === "authenticated";
  if (!isAdmin) return { error: "권한이 없습니다." };

  const admin = getAdminClient();
  await admin.from("comments").delete().eq("id", commentId);
  return { success: true };
}
