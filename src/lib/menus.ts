"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export type Menu = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_cents: number;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export async function listMyMenus(): Promise<Menu[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("menus")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as Menu[];
}

export async function listMenusByUserId(userId: string): Promise<Menu[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("menus")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as Menu[];
}

export async function listMenusForSlot(slotId: string): Promise<Menu[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("slot_menus")
    .select("menu:menus!slot_menus_menu_id_fkey(*)")
    .eq("slot_id", slotId);
  return ((data ?? []) as unknown as Array<{ menu: Menu }>)
    .map((r) => r.menu)
    .filter(Boolean) as Menu[];
}

export async function createMenu(args: {
  name: string;
  category?: string | null;
  description?: string | null;
  price_cents: number;
  active?: boolean;
}) {
  const userId = await requireUserId();
  if (!args.name.trim()) return { error: "이름을 입력해주세요." };
  const db = getAdminClient();
  const { error } = await db.from("menus").insert({
    user_id: userId,
    name: args.name.trim(),
    category: args.category?.trim() || null,
    description: args.description?.trim() || null,
    price_cents: Math.max(0, Math.round(args.price_cents)),
    active: args.active ?? true,
  });
  if (error) return { error: "생성에 실패했어요." };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateMenu(
  id: string,
  patch: Partial<
    Pick<Menu, "name" | "category" | "description" | "price_cents" | "active">
  >,
) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db
    .from("menus")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "수정 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteMenu(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db
    .from("menus")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "삭제 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

/** Replace the full set of menus attached to a slot owned by the caller. */
export async function setSlotMenus(slotId: string, menuIds: string[]) {
  const userId = await requireUserId();
  const db = getAdminClient();

  // Ownership check.
  const { data: slot } = await db
    .from("time_slots")
    .select("host_id")
    .eq("id", slotId)
    .single();
  if (!slot || slot.host_id !== userId) return { error: "권한이 없어요." };

  // Validate that every menu id belongs to this user.
  if (menuIds.length > 0) {
    const { data: mine } = await db
      .from("menus")
      .select("id")
      .eq("user_id", userId)
      .in("id", menuIds);
    const mineSet = new Set((mine ?? []).map((r) => r.id as string));
    for (const m of menuIds) {
      if (!mineSet.has(m)) return { error: "내가 만든 메뉴만 연결할 수 있어요." };
    }
  }

  await db.from("slot_menus").delete().eq("slot_id", slotId);
  if (menuIds.length > 0) {
    const rows = menuIds.map((m) => ({ slot_id: slotId, menu_id: m }));
    await db.from("slot_menus").insert(rows);
  }
  revalidatePath("/", "layout");
  return { success: true };
}
