// 일반 서버 모듈 — 서버 액션 아님(보안-6). 클라이언트용은 *-actions.ts
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function getUserId() {
  const session = await getSession();
  if (!session) return null;

  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();

  return data?.id as string | null;
}

export async function requireUserId() {
  const id = await getUserId();
  if (!id) throw new Error("Unauthorized");
  return id;
}
