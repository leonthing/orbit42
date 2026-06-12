"use server";

import { getAdminClient } from "@/lib/supabase";

export interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string;
  tags: string[];
}

export interface BlogAuthor {
  username: string;
  display_name: string | null;
  bio: string | null;
  social_links: Record<string, string> | null;
}

export async function getPublishedPosts(username: string) {
  const db = getAdminClient();

  const { data: user } = await db
    .from("users")
    .select("id, username, display_name, bio, social_links")
    .eq("username", username)
    .single();

  if (!user) return null;

  const { data: posts, error } = await db
    .from("blog_posts")
    .select("id, slug, title, content, excerpt, cover_image, published_at, tags")
    .eq("user_id", user.id)
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);

  return {
    author: user as BlogAuthor,
    posts: (posts ?? []) as PublicBlogPost[],
  };
}

export async function getPublishedPost(username: string, slug: string) {
  const db = getAdminClient();
  const decodedSlug = decodeURIComponent(slug);

  const { data: user } = await db
    .from("users")
    .select("id, username, display_name, bio, social_links")
    .eq("username", username)
    .single();

  if (!user) return null;

  const { data: post, error } = await db
    .from("blog_posts")
    .select("id, slug, title, content, excerpt, cover_image, published_at, tags")
    .eq("user_id", user.id)
    .eq("slug", decodedSlug)
    .eq("published", true)
    .single();

  if (error) return null;

  return {
    author: user as BlogAuthor,
    post: post as PublicBlogPost,
  };
}

/**
 * When a slug was renamed, find where it points now.
 * Returns the post's current slug, or null when unknown.
 */
export async function resolveRenamedSlug(username: string, slug: string) {
  const db = getAdminClient();
  const decodedSlug = decodeURIComponent(slug);

  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (!user) return null;

  const { data: redirect } = await db
    .from("blog_post_slugs")
    .select("post_id")
    .eq("user_id", user.id)
    .eq("slug", decodedSlug)
    .maybeSingle();
  if (!redirect) return null;

  const { data: post } = await db
    .from("blog_posts")
    .select("slug, published")
    .eq("id", redirect.post_id)
    .maybeSingle();
  if (!post?.published) return null;
  return post.slug as string;
}
