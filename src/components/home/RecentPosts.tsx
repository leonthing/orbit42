import { PostMeta } from "@/types/post";
import { PostCard } from "@/components/blog/PostCard";
import Link from "next/link";

interface RecentPostsProps {
  posts: PostMeta[];
}

export function RecentPosts({ posts }: RecentPostsProps) {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
          최근 글
        </h2>
        <Link
          href="/blog"
          className="text-sm text-navy-600 hover:text-navy-500 dark:text-navy-400 dark:hover:text-navy-300"
        >
          모든 글 보기 &rarr;
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
