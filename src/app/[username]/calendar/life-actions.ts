"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export type LifeMemory = {
  id: string;
  year: number;
  week: number;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
};

export async function getLifeMemories(): Promise<LifeMemory[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("life_memories")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: true })
    .order("week", { ascending: true })
    .order("created_at", { ascending: false });
  return (data || []) as LifeMemory[];
}

export async function getLifeMemoriesForWeek(year: number, week: number): Promise<LifeMemory[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("life_memories")
    .select("*")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("week", week)
    .order("created_at", { ascending: false });
  return (data || []) as LifeMemory[];
}

export async function createLifeMemory(
  year: number,
  week: number,
  title: string,
  content?: string,
): Promise<LifeMemory> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data, error } = await db
    .from("life_memories")
    .insert({ user_id: userId, year, week, title, content: content || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LifeMemory;
}

export async function updateLifeMemory(
  id: string,
  title: string,
  content?: string,
): Promise<LifeMemory> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data, error } = await db
    .from("life_memories")
    .update({ title, content: content || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LifeMemory;
}

export async function deleteLifeMemory(id: string): Promise<void> {
  const userId = await requireUserId();
  const db = getAdminClient();
  await db
    .from("life_memories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}
