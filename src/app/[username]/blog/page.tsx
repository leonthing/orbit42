import type { Metadata } from "next";
import { getBlogPosts } from "./actions";
import BlogPostList from "./BlogPostList";

export const metadata: Metadata = { title: "Blog" };

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return <BlogPostList initialPosts={posts} />;
}
