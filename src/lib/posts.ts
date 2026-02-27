import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import { Post, PostMeta } from "@/types/post";

const POSTS_DIR = path.join(process.cwd(), "content/posts");

function getPostFiles(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith(".mdx"));
}

export function getPostBySlug(slug: string): Post | null {
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

export function getAllPosts(): PostMeta[] {
  const files = getPostFiles();

  const posts = files
    .map((file) => {
      const slug = file.replace(/\.mdx$/, "");
      const post = getPostBySlug(slug);
      if (!post || !post.published) return null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content: _, ...meta } = post;
      return meta;
    })
    .filter(Boolean) as PostMeta[];

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getAllTags(): { tag: string; count: number }[] {
  const posts = getAllPosts();
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

export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPosts().filter((post) =>
    post.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
  );
}

export function getPostsByCategory(category: string): PostMeta[] {
  if (category === "All") return getAllPosts();
  return getAllPosts().filter((post) => post.category === category);
}

export function getAdjacentPosts(
  slug: string
): { prev: PostMeta | null; next: PostMeta | null } {
  const posts = getAllPosts();
  const index = posts.findIndex((p) => p.slug === slug);

  return {
    prev: index < posts.length - 1 ? posts[index + 1] : null,
    next: index > 0 ? posts[index - 1] : null,
  };
}

export function getAllSlugs(): string[] {
  return getPostFiles().map((file) => file.replace(/\.mdx$/, ""));
}
