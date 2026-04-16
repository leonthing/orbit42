"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";

function adminList(): string[] {
  const raw = process.env.ADMIN_USERNAMES || "leokim5854";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return adminList().includes(session.username.toLowerCase());
}

export async function requireAdmin(): Promise<{ username: string } | null> {
  const session = await getSession();
  if (!session) return null;
  if (!adminList().includes(session.username.toLowerCase())) return null;
  return session;
}

export async function adminDeleteUser(userId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "권한이 없어요." };
  if (!userId) return { error: "잘못된 요청입니다." };

  const db = getAdminClient();

  // Prevent deleting yourself via the admin panel.
  const { data: me } = await db
    .from("users")
    .select("id")
    .eq("username", admin.username)
    .single();
  if (me?.id === userId) {
    return { error: "본인 계정은 여기서 삭제할 수 없어요 (Settings에서 진행)." };
  }

  const { error } = await db.from("users").delete().eq("id", userId);
  if (error) {
    console.error("adminDeleteUser", error);
    return { error: "삭제에 실패했어요." };
  }
  revalidatePath("/admin");
  return { ok: true as const };
}
