"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import type { LocationBuffer } from "@/lib/location-buffers-types";

export async function listLocationBuffers(
  userId?: string,
): Promise<LocationBuffer[]> {
  const uid = userId ?? (await requireUserId());
  const db = getAdminClient();
  const { data } = await db
    .from("location_buffers")
    .select("id, name, buffer_min, aliases")
    .eq("user_id", uid)
    .order("buffer_min", { ascending: true });
  return ((data ?? []) as LocationBuffer[]).map((r) => ({
    ...r,
    aliases: r.aliases ?? [],
  }));
}

export async function createLocationBuffer(args: {
  name: string;
  buffer_min: number;
  aliases: string[];
}): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  const name = args.name.trim();
  if (!name) return { error: "이름을 입력해주세요." };
  if (args.buffer_min < 0 || args.buffer_min > 720) {
    return { error: "버퍼는 0~720분 사이여야 해요." };
  }
  const db = getAdminClient();
  const aliases = args.aliases.map((a) => a.trim()).filter(Boolean);
  const { error } = await db.from("location_buffers").insert({
    user_id: userId,
    name,
    buffer_min: args.buffer_min,
    aliases,
  });
  if (error) {
    if (error.message.includes("duplicate")) {
      return { error: "같은 이름의 장소가 이미 있어요." };
    }
    console.error("createLocationBuffer", error);
    return { error: "생성에 실패했어요." };
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function updateLocationBuffer(
  id: string,
  patch: { name?: string; buffer_min?: number; aliases?: string[] },
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) return { error: "이름을 입력해주세요." };
    payload.name = n;
  }
  if (patch.buffer_min !== undefined) {
    if (patch.buffer_min < 0 || patch.buffer_min > 720) {
      return { error: "버퍼는 0~720분 사이여야 해요." };
    }
    payload.buffer_min = patch.buffer_min;
  }
  if (patch.aliases !== undefined) {
    payload.aliases = patch.aliases.map((a) => a.trim()).filter(Boolean);
  }
  const { error } = await db
    .from("location_buffers")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "수정 실패" };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function deleteLocationBuffer(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db
    .from("location_buffers")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "삭제 실패" };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

