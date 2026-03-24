"use server";

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
