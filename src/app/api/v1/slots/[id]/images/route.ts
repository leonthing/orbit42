import { randomUUID } from "node:crypto";
import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = "slot-media";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_SLOT = 6;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function findMySlot(userId: string, slotId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("time_slots")
    .select("id, image_urls")
    .eq("id", slotId)
    .eq("host_id", userId)
    .maybeSingle();
  return data as { id: string; image_urls: string[] | null } | null;
}

// POST multipart(files) — 슬롯 공유 이미지 추가.
// 첫 번째 이미지가 공유 링크(OG) 미리보기에 쓰인다.
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const slot = await findMySlot(userId, params.id);
  if (!slot) {
    return Response.json({ error: "슬롯을 찾을 수 없어요." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "사진을 선택해 주세요." }, { status: 400 });
  }
  const current = slot.image_urls ?? [];
  if (current.length + files.length > MAX_PER_SLOT) {
    return Response.json(
      { error: `슬롯 이미지는 최대 ${MAX_PER_SLOT}장이에요.` },
      { status: 400 },
    );
  }

  const db = getAdminClient();
  const urls: string[] = [];
  for (const f of files) {
    if (f.size === 0) continue;
    if (f.size > MAX_BYTES) {
      return Response.json({ error: "사진 한 장은 5MB 이하여야 해요." }, { status: 400 });
    }
    const ext = ALLOWED[f.type];
    if (!ext) {
      return Response.json(
        { error: "JPG, PNG, WEBP, GIF 사진만 올릴 수 있어요." },
        { status: 400 },
      );
    }
    const key = `${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(key, buf, { contentType: f.type, upsert: false });
    if (upErr) {
      console.error("slot image upload", upErr);
      return Response.json({ error: "업로드에 실패했어요." }, { status: 400 });
    }
    urls.push(db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl);
  }

  const next = [...current, ...urls];
  const { error } = await db
    .from("time_slots")
    .update({ image_urls: next, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("host_id", userId);
  if (error) {
    return Response.json({ error: "저장에 실패했어요." }, { status: 400 });
  }
  return Response.json({ imageUrls: next });
}

// DELETE ?url=... — 슬롯 이미지 한 장 제거 (스토리지 파일 포함)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  const slot = await findMySlot(userId, params.id);
  if (!slot) {
    return Response.json({ error: "슬롯을 찾을 수 없어요." }, { status: 404 });
  }
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return Response.json({ error: "url이 필요해요." }, { status: 400 });
  }

  const db = getAdminClient();
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    const key = decodeURIComponent(url.slice(idx + marker.length));
    if (key.startsWith(`${userId}/`)) {
      await db.storage.from(BUCKET).remove([key]);
    }
  }
  const next = (slot.image_urls ?? []).filter((u) => u !== url);
  const { error } = await db
    .from("time_slots")
    .update({ image_urls: next, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("host_id", userId);
  if (error) {
    return Response.json({ error: "저장에 실패했어요." }, { status: 400 });
  }
  return Response.json({ imageUrls: next });
}
