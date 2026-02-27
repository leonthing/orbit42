import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import { Post, PostMeta } from "@/types/post";
import { supabase } from "./supabase";

const POSTS_DIR = path.join(process.cwd(), "content/posts");

// --- MDX file-based posts ---

function getPostFiles(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith(".mdx"));
}

export function getMdxPostBySlug(slug: string): Post | null {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const stats = readingTime(content);

  return {
    slug,
    title: data.title,
    date: data.date,
    description: data.description,
    tags: data.tags || [],
    category: data.category || "Thoughts",
    published: data.published !== false,
    image: data.image,
    readingTime: stats.text,
    content,
  };
}

function getAllMdxPosts(): PostMeta[] {
  const files = getPostFiles();

  return files
    .map((file) => {
      const slug = file.replace(/\.mdx$/, "");
      const post = getMdxPostBySlug(slug);
      if (!post || !post.published) return null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content: _, ...meta } = post;
      return meta;
    })
    .filter(Boolean) as PostMeta[];
}

// --- Supabase posts ---

async function getSupabasePostsMeta(): Promise<PostMeta[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      slug: row.slug,
      title: row.title,
      description: row.description,
      date: row.created_at,
      category: row.category,
      tags: row.tags || [],
      published: true,
      readingTime: readingTime(row.content).text,
    }));
  } catch {
    return [];
  }
}

async function getSupabasePost(slug: string): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (error || !data) return null;

    return {
      slug: data.slug,
      title: data.title,
      description: data.description,
      date: data.created_at,
      category: data.category,
      tags: data.tags || [],
      published: true,
      readingTime: readingTime(data.content).text,
      content: data.content,
    };
  } catch {
    return null;
  }
}

// --- Merged (MDX + Supabase) ---

export async function getAllPosts(): Promise<PostMeta[]> {
  const [mdx, db] = await Promise.all([
    getAllMdxPosts(),
    getSupabasePostsMeta(),
  ]);

  const slugs = new Set<string>();
  const merged: PostMeta[] = [];

  // DB posts take priority
  for (const post of db) {
    slugs.add(post.slug);
    merged.push(post);
  }
  for (const post of mdx) {
    if (!slugs.has(post.slug)) {
      merged.push(post);
    }
  }

  return merged.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  // Try Supabase first, then fallback to MDX
  const dbPost = await getSupabasePost(slug);
  if (dbPost) return dbPost;
  return getMdxPostBySlug(slug);
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const posts = await getAllPosts();
  const tagMap = new Map<string, number>();

  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getPostsByTag(tag: string): Promise<PostMeta[]> {
  const posts = await getAllPosts();
  return posts.filter((post) =>
    post.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
  );
}

export async function getPostsByCategory(category: string): Promise<PostMeta[]> {
  if (category === "All") return getAllPosts();
  const posts = await getAllPosts();
  return posts.filter((post) => post.category === category);
}

export async function getAdjacentPosts(
  slug: string
): Promise<{ prev: PostMeta | null; next: PostMeta | null }> {
  const posts = await getAllPosts();
  const index = posts.findIndex((p) => p.slug === slug);

  return {
    prev: index < posts.length - 1 ? posts[index + 1] : null,
    next: index > 0 ? posts[index - 1] : null,
  };
}

export async function getAllSlugs(): Promise<string[]> {
  const posts = await getAllPosts();
  return posts.map((p) => p.slug);
}
