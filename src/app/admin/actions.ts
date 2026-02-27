"use server";

import { cookies } from "next/headers";
import {
  createPost,
  updatePost,
  deletePost,
  getAllPostsAdmin,
  getPostBySlugAdmin,
} from "@/lib/supabase-posts";

const COOKIE_NAME = "admin_session";

export async function login(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD || "orbit42admin";
  if (password !== adminPassword) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }
  cookies().set(COOKIE_NAME, "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24h
  });
  return { success: true };
}

export async function logout() {
  cookies().delete(COOKIE_NAME);
  return { success: true };
}

export async function isAuthenticated() {
  return cookies().get(COOKIE_NAME)?.value === "authenticated";
}

export async function fetchAllPosts() {
  if (!(await isAuthenticated())) return { error: "Unauthorized" };
  const posts = await getAllPostsAdmin();
  return { posts };
}

export async function fetchPost(slug: string) {
  if (!(await isAuthenticated())) return { error: "Unauthorized" };
  const post = await getPostBySlugAdmin(slug);
  return { post };
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function savePost(formData: {
  slug?: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  published: boolean;
  isNew: boolean;
}) {
  if (!(await isAuthenticated())) return { error: "Unauthorized" };

  try {
    const slug = formData.slug || generateSlug(formData.title);
    const postData = {
      slug,
      title: formData.title,
      description: formData.description,
      content: formData.content,
      category: formData.category,
      tags: formData.tags,
      published: formData.published,
    };

    if (formData.isNew) {
      await createPost(postData);
    } else {
      await updatePost(slug, postData);
    }

    return { success: true, slug };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return { error: message };
  }
}

export async function removePost(slug: string) {
  if (!(await isAuthenticated())) return { error: "Unauthorized" };

  try {
    await deletePost(slug);
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "삭제에 실패했습니다.";
    return { error: message };
  }
}
