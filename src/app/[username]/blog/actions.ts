"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId, getUserId } from "@/lib/db";

export interface BlogPost {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  cover_image: string | null;
  published: boolean;
  published_at: string | null;
  tags: string[];
  social_x: string | null;
  social_facebook: string | null;
  social_linkedin: string | null;
  created_at: string;
  updated_at: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "untitled";
}

export async function getBlogPosts() {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("blog_posts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
}

export async function getPublicPostsByUsername(username: string) {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (!user) return [] as BlogPost[];

  const { data } = await db
    .from("blog_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("published", true)
    .order("published_at", { ascending: false });
  return (data ?? []) as BlogPost[];
}

export async function getPublicPostBySlug(username: string, slug: string) {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id, username, display_name")
    .eq("username", username)
    .single();
  if (!user) return null;

  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // keep as-is
  }

  // Owner can view their own drafts in read mode; everyone else only
  // sees published posts.
  const viewerId = await getUserId().catch(() => null);
  const isOwner = viewerId === user.id;

  let q = db
    .from("blog_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("slug", decoded);
  if (!isOwner) q = q.eq("published", true);
  const { data: post } = await q.maybeSingle();
  if (!post) return null;
  return {
    post: post as BlogPost,
    author: {
      username: user.username as string,
      display_name: user.display_name as string | null,
    },
    isOwner,
  };
}

export async function getBlogPost(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data as BlogPost;
}

export async function createBlogPost(data?: { title?: string }) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const title = data?.title || "새 글";
  let slug = slugify(title);

  // Check slug uniqueness, append suffix if needed
  const { data: existing } = await db
    .from("blog_posts")
    .select("slug")
    .eq("user_id", userId)
    .like("slug", `${slug}%`);

  if (existing && existing.length > 0) {
    const slugs = new Set(existing.map((e: { slug: string }) => e.slug));
    if (slugs.has(slug)) {
      let i = 2;
      while (slugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
  }

  const now = new Date().toISOString();
  const { data: post, error } = await db
    .from("blog_posts")
    .insert({
      user_id: userId,
      title,
      slug,
      content: "",
      published: false,
      tags: [],
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return post as BlogPost;
}

export async function updateBlogPost(
  id: string,
  data: Partial<
    Pick<
      BlogPost,
      "title" | "content" | "excerpt" | "slug" | "tags" | "cover_image"
    >
  >
) {
  const userId = await requireUserId();
  const db = getAdminClient();

  // Renaming the slug? Remember the old one so existing links 301 to
  // the new URL instead of 404ing.
  let oldSlug: string | null = null;
  if (data.slug) {
    const { data: current } = await db
      .from("blog_posts")
      .select("slug")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (current?.slug && current.slug !== data.slug) {
      oldSlug = current.slug as string;
    }
  }

  const { data: post, error } = await db
    .from("blog_posts")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (oldSlug && data.slug) {
    await db
      .from("blog_post_slugs")
      .upsert(
        { user_id: userId, slug: oldSlug, post_id: id },
        { onConflict: "user_id,slug" },
      );
    // The new slug is live again — drop any stale redirect entry for it.
    await db
      .from("blog_post_slugs")
      .delete()
      .eq("user_id", userId)
      .eq("slug", data.slug);
  }

  return post as BlogPost;
}

export async function publishBlogPost(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const now = new Date().toISOString();
  const { data: post, error } = await db
    .from("blog_posts")
    .update({ published: true, published_at: now, updated_at: now })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return post as BlogPost;
}

export async function unpublishBlogPost(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: post, error } = await db
    .from("blog_posts")
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return post as BlogPost;
}

export async function saveSocialTexts(
  id: string,
  data: { social_x?: string; social_facebook?: string; social_linkedin?: string }
) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("blog_posts")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteBlogPost(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("blog_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
