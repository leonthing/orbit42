import { Suspense } from "react";
import { Metadata } from "next";
import { getAllPosts, getAllTags, getPostsByCategory, getPostsByTag } from "@/lib/posts";
import { PostList } from "@/components/blog/PostList";
import { CategoryFilter } from "@/components/blog/CategoryFilter";
import { TagCloud } from "@/components/blog/TagCloud";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description: "모든 블로그 글 목록",
};

interface Props {
  searchParams: { category?: string; tag?: string };
}

export default async function BlogPage({ searchParams }: Props) {
  const allPosts = await getAllPosts();
  const category = searchParams.category || "All";
  const tag = searchParams.tag || "";

  let posts = allPosts;
  if (tag) {
    posts = await getPostsByTag(tag);
  } else if (category !== "All") {
    posts = await getPostsByCategory(category);
  }

  const categories = Array.from(new Set(allPosts.map((p) => p.category))).sort();
  const tags = await getAllTags();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-charcoal-900 dark:text-charcoal-100">
          Blog
        </h1>
        <p className="text-charcoal-600 dark:text-charcoal-400">
          총 {posts.length}개의 글
        </p>
      </div>
      {categories.length > 1 && (
        <Suspense>
          <CategoryFilter categories={categories} />
        </Suspense>
      )}
      {tags.length > 0 && (
        <Suspense>
          <TagCloud tags={tags} />
        </Suspense>
      )}
      <PostList posts={posts} />
    </div>
  );
}
