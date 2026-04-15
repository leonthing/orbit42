"use server";

import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

const BUCKET = "slot-media";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
const MAX_PER_SLOT = 6;
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

export async function uploadSlotImages(
  formData: FormData,
): Promise<{ urls: string[] } | { error: string }> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const files = formData.getAll("files");
  if (files.length === 0) return { urls: [] };
  if (files.length > MAX_PER_SLOT) {
    return { error: `한 슬롯에 이미지는 최대 ${MAX_PER_SLOT}장이에요.` };
  }
  const urls: string[] = [];
  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > MAX_BYTES) {
      return { error: `사진 한 장은 ${MAX_BYTES / 1024 / 1024}MB 이하여야 해요.` };
    }
    if (!ALLOWED.has(f.type)) {
      return { error: "JPG, PNG, WEBP, GIF 사진만 업로드할 수 있어요." };
    }
    const ext = EXT_BY_TYPE[f.type] || "jpg";
    const key = `${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(key, buf, { contentType: f.type, upsert: false });
    if (upErr) {
      console.error("slot-media upload", upErr);
      return { error: "업로드에 실패했어요." };
    }
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(key);
    urls.push(pub.publicUrl);
  }
  return { urls };
}
