import { PostMeta } from "@/types/post";
import { PostCard } from "./PostCard";

interface PostListProps {
  posts: PostMeta[];
}

export function PostList({ posts }: PostListProps) {
  if (posts.length === 0) {
    return (
      <p className="py-10 text-center text-charcoal-500 dark:text-charcoal-400">
        아직 작성된 글이 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}
    </div>
  );
}
