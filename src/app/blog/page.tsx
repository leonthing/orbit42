import { Suspense } from "react";
import { Metadata } from "next";
import { getAllPosts, getPostsByCategory } from "@/lib/posts";
import { PostList } from "@/components/blog/PostList";
import { CategoryFilter } from "@/components/blog/CategoryFilter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description: "모든 블로그 글 목록",
};

interface Props {
  searchParams: { category?: string };
}

export default async function BlogPage({ searchParams }: Props) {
  const category = searchParams.category || "All";
  const posts =
    category === "All" ? await getAllPosts() : await getPostsByCategory(category);

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
      <Suspense>
        <CategoryFilter />
      </Suspense>
      <PostList posts={posts} />
    </div>
  );
}
