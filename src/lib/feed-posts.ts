"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import { randomUUID } from "node:crypto";

export type FeedPost = {
  id: string;
  user_id: string;
  body: string;
  image_urls: string[];
  location_label: string | null;
  attached_event_id: string | null;
  attached_slot_id: string | null;
  created_at: string;
};

const BUCKET = "feed-media";
const MAX_BODY = 1000;
const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image

export async function createFeedPost(formData: FormData) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const body = String(formData.get("body") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const attachedSlotId = String(formData.get("attached_slot_id") ?? "").trim();
  const files = formData.getAll("images") as File[];

  if (!body && files.length === 0 && !attachedSlotId) {
    return { error: "내용을 입력하거나 사진을 추가해주세요." };
  }
  if (body.length > MAX_BODY) {
    return { error: `본문은 ${MAX_BODY}자 이하로 작성해주세요.` };
  }
  if (files.length > MAX_IMAGES) {
    return { error: `사진은 최대 ${MAX_IMAGES}장까지 가능합니다.` };
  }

  const imageUrls: string[] = [];
  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > MAX_BYTES) {
      return { error: `사진 한 장은 ${MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.` };
    }
    if (!f.type.startsWith("image/")) {
      return { error: "사진만 업로드할 수 있습니다." };
    }
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const key = `${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(key, buf, { contentType: f.type, upsert: false });
    if (upErr) {
      console.error("upload err", upErr);
      return { error: "사진 업로드에 실패했습니다." };
    }
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(key);
    if (pub?.publicUrl) imageUrls.push(pub.publicUrl);
  }

  const { error } = await db.from("feed_posts").insert({
    user_id: userId,
    body,
    image_urls: imageUrls,
    location_label: location || null,
    attached_slot_id: attachedSlotId || null,
  });
  if (error) {
    console.error("feed_posts insert", error);
    return { error: "게시에 실패했습니다." };
  }

  revalidatePath("/feed");
  revalidatePath("/explore");
  return { success: true };
}

export async function deleteFeedPost(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db
    .from("feed_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "삭제에 실패했습니다." };
  revalidatePath("/feed");
  return { success: true };
}

/** Posts authored by the given user ids, recent first. */
export async function listFeedPostsByAuthors(
  authorIds: string[],
  limit = 50,
): Promise<FeedPost[]> {
  if (authorIds.length === 0) return [];
  const db = getAdminClient();
  const { data } = await db
    .from("feed_posts")
    .select("*")
    .in("user_id", authorIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as FeedPost[];
}
