"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export type NoteCategory = "idea" | "meeting" | "memo";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: NoteCategory;
  pinned: boolean;
  business_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getNotes(category?: NoteCategory) {
  const userId = await requireUserId();
  const db = getAdminClient();

  let query = db
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Note[];
}

export async function getNote(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("notes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data as Note;
}

export async function createNote(data: {
  title: string;
  content?: string;
  category?: NoteCategory;
}) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const now = new Date().toISOString();
  const { data: note, error } = await db
    .from("notes")
    .insert({
      user_id: userId,
      title: data.title || "새 노트",
      content: data.content ?? "",
      category: data.category ?? "memo",
      pinned: false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return note as Note;
}

export async function updateNote(
  id: string,
  data: Partial<Pick<Note, "title" | "content" | "category" | "pinned" | "business_id">>
) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: note, error } = await db
    .from("notes")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return note as Note;
}

export async function deleteNote(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function togglePin(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: existing, error: fetchError } = await db
    .from("notes")
    .select("pinned")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { data: note, error } = await db
    .from("notes")
    .update({ pinned: !existing.pinned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return note as Note;
}
