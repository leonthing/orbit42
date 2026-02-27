import { Metadata } from "next";
import { getAllTags, getPostsByTag } from "@/lib/posts";
import { PostList } from "@/components/blog/PostList";

interface Props {
  params: { tag: string };
}

export async function generateStaticParams() {
  return getAllTags().map(({ tag }) => ({
    tag: tag.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag);
  return {
    title: `#${tag}`,
    description: `"${tag}" 태그가 달린 글 목록`,
  };
}

export default function TagPage({ params }: Props) {
  const tag = decodeURIComponent(params.tag);
  const posts = getPostsByTag(tag);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-charcoal-900 dark:text-charcoal-100">
          #{tag}
        </h1>
        <p className="text-charcoal-600 dark:text-charcoal-400">
          {posts.length}개의 글
        </p>
      </div>
      <PostList posts={posts} />
    </div>
  );
}
