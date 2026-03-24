"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export type Business = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "closed";
  industry: string | null;
  url: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessInput = {
  name: string;
  description?: string;
  status?: "active" | "paused" | "closed";
  industry?: string;
  url?: string;
};

export async function getBusinesses(): Promise<Business[]> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("사업체 목록을 불러올 수 없습니다.");
  return (data ?? []) as Business[];
}

export async function getBusiness(id: string): Promise<Business | null> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("businesses")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data as Business;
}

export async function createBusiness(input: BusinessInput) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("businesses")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description || null,
      status: input.status || "active",
      industry: input.industry || null,
      url: input.url || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return { error: "사업체 생성에 실패했습니다." };
  return { success: true, data: data as Business };
}

export async function updateBusiness(id: string, input: Partial<BusinessInput>) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("businesses")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { error: "사업체 수정에 실패했습니다." };
  return { success: true, data: data as Business };
}

export async function deleteBusiness(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("businesses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: "사업체 삭제에 실패했습니다." };
  return { success: true };
}
