"use server";

import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

// Reuse the existing user-uploads bucket so no extra Supabase setup is
// needed — blog images live under a blog/{userId}/ key prefix.
const BUCKET = "feed-media";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per image
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadBlogImage(
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const f = formData.get("file");
  if (!(f instanceof File) || f.size === 0) {
    return { error: "이미지를 선택해주세요." };
  }
  if (f.size > MAX_BYTES) {
    return { error: `이미지 한 장은 ${MAX_BYTES / 1024 / 1024}MB 이하여야 해요.` };
  }
  if (!ALLOWED.has(f.type)) {
    return { error: "JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있어요." };
  }
  const ext = EXT_BY_TYPE[f.type] || "jpg";
  const key = `blog/${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const buf = Buffer.from(await f.arrayBuffer());
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: f.type, upsert: false });
  if (upErr) {
    console.error("blog-media upload", upErr);
    return { error: "업로드에 실패했어요." };
  }
  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(key);
  return { url: pub.publicUrl };
}
