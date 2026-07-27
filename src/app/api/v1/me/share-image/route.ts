import { randomUUID } from "node:crypto";
import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = "slot-media";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function removeStored(userId: string, url: string | null) {
  if (!url) return;
  const db = getAdminClient();
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return;
  const key = decodeURIComponent(url.slice(idx + marker.length));
  if (key.startsWith(`share/${userId}/`)) {
    await db.storage.from(BUCKET).remove([key]);
  }
}

// POST multipart(file) — 프로필 공유(OG) 헤더 이미지 설정.
// 설정하면 프로필 링크 미리보기가 자동 명함 카드 대신 이 이미지로 나간다.
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "사진을 선택해 주세요." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "5MB 이하 사진만 가능해요." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return Response.json({ error: "JPG, PNG, WEBP 사진만 가능해요." }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: me } = await db
    .from("users")
    .select("share_image_url")
    .eq("id", userId)
    .single();

  const key = `share/${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("share image upload", upErr);
    return Response.json({ error: "업로드에 실패했어요." }, { status: 400 });
  }
  const url = db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;

  const { error } = await db
    .from("users")
    .update({ share_image_url: url, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    return Response.json({ error: "저장에 실패했어요." }, { status: 400 });
  }
  // 이전 이미지는 뒤늦게 정리 (실패해도 무시).
  await removeStored(userId, (me?.share_image_url as string | null) ?? null);
  return Response.json({ ok: true, shareImageUrl: url });
}

// DELETE — 공유 이미지 해제 (자동 명함 카드로 복귀)
export async function DELETE(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const db = getAdminClient();
  const { data: me } = await db
    .from("users")
    .select("share_image_url")
    .eq("id", userId)
    .single();
  const { error } = await db
    .from("users")
    .update({ share_image_url: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    return Response.json({ error: "저장에 실패했어요." }, { status: 400 });
  }
  await removeStored(userId, (me?.share_image_url as string | null) ?? null);
  return Response.json({ ok: true, shareImageUrl: null });
}
