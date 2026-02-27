import readingTime from "reading-time";
import { supabase, getAdminClient } from "./supabase";
import { PostMeta } from "@/types/post";

export interface SupabasePost {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  published: boolean;
  created_at: string;
  updated_at: string;
}

function toPostMeta(row: SupabasePost): PostMeta {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.created_at,
    category: row.category,
    tags: row.tags || [],
    published: row.published,
    readingTime: readingTime(row.content).text,
  };
}

// --- Public reads (anon key) ---

export async function getSupabasePosts(): Promise<PostMeta[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(toPostMeta);
}

export async function getSupabasePostBySlug(slug: string) {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error) return null;
  return data as SupabasePost;
}

// --- Admin writes (service role) ---

export async function getAllPostsAdmin(): Promise<SupabasePost[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPostBySlugAdmin(slug: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return data as SupabasePost;
}

export async function createPost(post: Omit<SupabasePost, "id" | "created_at" | "updated_at">) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("posts")
    .insert(post)
    .select()
    .single();

  if (error) throw error;
  return data as SupabasePost;
}

export async function updatePost(slug: string, post: Partial<Omit<SupabasePost, "id" | "created_at" | "updated_at">>) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("posts")
    .update(post)
    .eq("slug", slug)
    .select()
    .single();

  if (error) throw error;
  return data as SupabasePost;
}

export async function deletePost(slug: string) {
  const admin = getAdminClient();
  const { error } = await admin
    .from("posts")
    .delete()
    .eq("slug", slug);

  if (error) throw error;
}
