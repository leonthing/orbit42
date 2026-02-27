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

// --- 조회수 & 좋아요 ---

export async function recordView(slug: string) {
  const admin = getAdminClient();

  // upsert: 없으면 생성, 있으면 view_count + 1
  const { data: existing } = await admin
    .from("post_stats")
    .select("view_count")
    .eq("post_slug", slug)
    .single();

  if (existing) {
    await admin
      .from("post_stats")
      .update({
        view_count: existing.view_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("post_slug", slug);
  } else {
    await admin.from("post_stats").insert({
      post_slug: slug,
      view_count: 1,
    });
  }
}

export async function getPostStats(slug: string) {
  const [statsResult, likesResult] = await Promise.all([
    supabase
      .from("post_stats")
      .select("view_count")
      .eq("post_slug", slug)
      .single(),
    supabase
      .from("post_likes")
      .select("id", { count: "exact", head: true })
      .eq("post_slug", slug),
  ]);

  return {
    viewCount: statsResult.data?.view_count ?? 0,
    likeCount: likesResult.count ?? 0,
  };
}

export async function toggleLike(slug: string, visitorId: string) {
  if (!visitorId) return { error: "방문자 ID가 필요합니다." };

  // 이미 좋아요 했는지 확인
  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_slug", slug)
    .eq("visitor_id", visitorId)
    .single();

  if (existing) {
    // 좋아요 취소
    await supabase
      .from("post_likes")
      .delete()
      .eq("post_slug", slug)
      .eq("visitor_id", visitorId);
    return { liked: false };
  } else {
    // 좋아요 추가
    await supabase.from("post_likes").insert({
      post_slug: slug,
      visitor_id: visitorId,
    });
    return { liked: true };
  }
}

export async function checkLiked(slug: string, visitorId: string) {
  if (!visitorId) return false;

  const { data } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_slug", slug)
    .eq("visitor_id", visitorId)
    .single();

  return !!data;
}

export async function getMultiPostStats(slugs: string[]) {
  if (slugs.length === 0) return {};

  const [statsResult, likesResult] = await Promise.all([
    supabase.from("post_stats").select("post_slug, view_count").in("post_slug", slugs),
    supabase.from("post_likes").select("post_slug"),
  ]);

  const statsMap: Record<string, { viewCount: number; likeCount: number }> = {};

  // Initialize all slugs
  for (const slug of slugs) {
    statsMap[slug] = { viewCount: 0, likeCount: 0 };
  }

  // Fill view counts
  if (statsResult.data) {
    for (const row of statsResult.data) {
      if (statsMap[row.post_slug]) {
        statsMap[row.post_slug].viewCount = row.view_count;
      }
    }
  }

  // Count likes per slug
  if (likesResult.data) {
    for (const row of likesResult.data) {
      if (statsMap[row.post_slug]) {
        statsMap[row.post_slug].likeCount++;
      }
    }
  }

  return statsMap;
}
