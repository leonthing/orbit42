/**
 * 시간 로그 (event_posts) — 일정에 사진·공개 범위를 붙여 "완료된 시간"을
 * 프로필/오르빗에서 볼 수 있는 기록으로 만든다.
 *
 * event_key 는 이벤트 분류·수익 기록과 같은 클라이언트 원형 id
 * (로컬 uuid / "gcal_<id>") — 캘린더 이동 시 migrateEventKeys 로 함께 이관된다.
 */

import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/lib/supabase";

const BUCKET = "slot-media"; // 기존 공개 버킷 재사용 (timelog/ 프리픽스)
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_POST = 10;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type EventPostVisibility = "private" | "followers" | "public";

export type EventPost = {
  id: string;
  event_key: string;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  note: string | null;
  image_urls: string[];
  visibility: EventPostVisibility;
};

export type EventSnapshot = {
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
};

function rowToPost(row: Record<string, unknown>): EventPost {
  return {
    id: row.id as string,
    event_key: row.event_key as string,
    title: row.title as string,
    start_at: row.start_at as string,
    end_at: (row.end_at as string | null) ?? null,
    all_day: Boolean(row.all_day),
    note: (row.note as string | null) ?? null,
    image_urls: (row.image_urls as string[] | null) ?? [],
    visibility: row.visibility as EventPostVisibility,
  };
}

export async function getEventPost(
  userId: string,
  eventKey: string,
): Promise<EventPost | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("event_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("event_key", eventKey)
    .maybeSingle();
  return data ? rowToPost(data) : null;
}

/** 스냅샷(제목/시간)으로 생성하거나, 이미 있으면 공개 범위·스냅샷을 갱신. */
export async function upsertEventPost(
  userId: string,
  eventKey: string,
  snapshot: EventSnapshot,
  visibility?: EventPostVisibility,
): Promise<EventPost | { error: string }> {
  const db = getAdminClient();
  const existing = await getEventPost(userId, eventKey);
  const patch: Record<string, unknown> = {
    title: snapshot.title,
    start_at: snapshot.start_at,
    end_at: snapshot.end_at,
    all_day: snapshot.all_day,
    updated_at: new Date().toISOString(),
  };
  if (visibility) patch.visibility = visibility;

  if (existing) {
    const { data, error } = await db
      .from("event_posts")
      .update(patch)
      .eq("user_id", userId)
      .eq("event_key", eventKey)
      .select()
      .single();
    if (error || !data) return { error: "저장에 실패했어요." };
    return rowToPost(data);
  }
  const { data, error } = await db
    .from("event_posts")
    .insert({
      user_id: userId,
      event_key: eventKey,
      ...patch,
      visibility: visibility ?? "followers",
    })
    .select()
    .single();
  if (error || !data) return { error: "저장에 실패했어요." };
  return rowToPost(data);
}

/** 사진 업로드 후 image_urls 에 추가 (없으면 포스트 생성). */
export async function addEventPostImages(
  userId: string,
  eventKey: string,
  snapshot: EventSnapshot,
  files: File[],
): Promise<EventPost | { error: string }> {
  const db = getAdminClient();
  const base = await upsertEventPost(userId, eventKey, snapshot);
  if ("error" in base) return base;
  if (base.image_urls.length + files.length > MAX_PER_POST) {
    return { error: `사진은 일정당 최대 ${MAX_PER_POST}장이에요.` };
  }

  const urls: string[] = [];
  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > MAX_BYTES) return { error: "사진 한 장은 5MB 이하여야 해요." };
    const ext = ALLOWED[f.type];
    if (!ext) return { error: "JPG, PNG, WEBP, GIF 사진만 올릴 수 있어요." };
    const key = `timelog/${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(key, buf, { contentType: f.type, upsert: false });
    if (upErr) {
      console.error("event-post upload", upErr);
      return { error: "업로드에 실패했어요." };
    }
    urls.push(db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl);
  }

  const { data, error } = await db
    .from("event_posts")
    .update({
      image_urls: [...base.image_urls, ...urls],
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("event_key", eventKey)
    .select()
    .single();
  if (error || !data) return { error: "저장에 실패했어요." };
  return rowToPost(data);
}

/** 사진 한 장 제거 (URL 기준). 스토리지 파일도 지운다. */
export async function removeEventPostImage(
  userId: string,
  eventKey: string,
  url: string,
): Promise<EventPost | { error: string }> {
  const db = getAdminClient();
  const post = await getEventPost(userId, eventKey);
  if (!post) return { error: "기록을 찾을 수 없어요." };
  if (!post.image_urls.includes(url)) return post;

  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    const key = decodeURIComponent(url.slice(idx + marker.length));
    // 본인 프리픽스만 삭제 허용.
    if (key.startsWith(`timelog/${userId}/`)) {
      await db.storage.from(BUCKET).remove([key]);
    }
  }
  const { data, error } = await db
    .from("event_posts")
    .update({
      image_urls: post.image_urls.filter((u) => u !== url),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("event_key", eventKey)
    .select()
    .single();
  if (error || !data) return { error: "저장에 실패했어요." };
  return rowToPost(data);
}

export async function deleteEventPost(
  userId: string,
  eventKey: string,
): Promise<{ ok: true } | { error: string }> {
  const db = getAdminClient();
  const post = await getEventPost(userId, eventKey);
  if (!post) return { ok: true };
  // 스토리지 정리 (본인 프리픽스만).
  const marker = `/object/public/${BUCKET}/`;
  const keys = post.image_urls
    .map((u) => {
      const idx = u.indexOf(marker);
      return idx >= 0 ? decodeURIComponent(u.slice(idx + marker.length)) : null;
    })
    .filter((k): k is string => !!k && k.startsWith(`timelog/${userId}/`));
  if (keys.length > 0) await db.storage.from(BUCKET).remove(keys);

  const { error } = await db
    .from("event_posts")
    .delete()
    .eq("user_id", userId)
    .eq("event_key", eventKey);
  if (error) return { error: "삭제에 실패했어요." };
  return { ok: true };
}

/** 어떤 사용자의 시간 로그 — viewer 관계에 따라 공개 범위를 거른다. */
export async function listEventPosts(
  ownerUserId: string,
  viewer: "me" | "follower" | "public",
  limit = 30,
): Promise<EventPost[]> {
  const db = getAdminClient();
  let query = db
    .from("event_posts")
    .select("*")
    .eq("user_id", ownerUserId)
    .order("start_at", { ascending: false })
    .limit(limit);
  if (viewer === "public") {
    query = query.eq("visibility", "public");
  } else if (viewer === "follower") {
    query = query.in("visibility", ["followers", "public"]);
  }
  const { data } = await query;
  return (data ?? []).map(rowToPost);
}
