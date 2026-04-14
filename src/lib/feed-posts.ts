"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { getAuthenticatedCalendar } from "@/lib/google";

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

  const addToCalendar = String(formData.get("add_to_calendar") ?? "") === "1";
  const calendarStartStr = String(formData.get("calendar_start") ?? "").trim();
  const calendarStart = calendarStartStr ? new Date(calendarStartStr) : new Date();

  const { data: inserted, error } = await db
    .from("feed_posts")
    .insert({
      user_id: userId,
      body,
      image_urls: imageUrls,
      location_label: location || null,
      attached_slot_id: attachedSlotId || null,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("feed_posts insert", error);
    return { error: "게시에 실패했습니다." };
  }

  // Optional: create a Google Calendar event to keep the feed post pinned
  // to a moment on the host's calendar.
  if (addToCalendar) {
    try {
      const calendar = await getAuthenticatedCalendar(userId);
      if (!calendar) {
        return {
          success: true,
          warn:
            "게시는 완료됐지만 캘린더에 저장하지 못했어요. Google Calendar를 먼저 연결해주세요.",
        };
      }
      const end = new Date(calendarStart.getTime() + 30 * 60_000);
      const firstLine = (body.split("\n")[0] || "").trim();
      const title = firstLine ? firstLine.slice(0, 80) : "포스트";
      const descriptionParts: string[] = [];
      if (body) descriptionParts.push(body);
      if (imageUrls.length > 0) {
        descriptionParts.push("", ...imageUrls);
      }
      descriptionParts.push("", "— via orbit42");

      const ev = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: title,
          description: descriptionParts.join("\n"),
          location: location || undefined,
          start: { dateTime: calendarStart.toISOString(), timeZone: "Asia/Seoul" },
          end: { dateTime: end.toISOString(), timeZone: "Asia/Seoul" },
        },
      });
      if (ev.data.id) {
        await db
          .from("feed_posts")
          .update({ attached_event_id: `primary::${ev.data.id}` })
          .eq("id", inserted.id);
      }
    } catch (err) {
      console.error("feed_post gcal insert failed", err);
      // Don't fail the whole post — surface a soft warning.
      return {
        success: true,
        warn: "게시는 완료됐지만 캘린더 저장에 실패했어요.",
      };
    }
  }

  revalidatePath("/feed");
  revalidatePath("/explore");
  revalidatePath("/", "layout");
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

/** Quick-share an existing calendar event as a feed post. */
export async function shareEventToFeed(args: {
  event_id: string; // "{calendar_id}::{gcal_event_id}"
  body: string;
  location?: string | null;
}) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db.from("feed_posts").insert({
    user_id: userId,
    body: args.body.slice(0, MAX_BODY),
    image_urls: [],
    location_label: args.location ?? null,
    attached_event_id: args.event_id,
  });
  if (error) {
    console.error("shareEventToFeed", error);
    return { error: "공유에 실패했습니다." };
  }
  revalidatePath("/feed");
  revalidatePath("/", "layout");
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
