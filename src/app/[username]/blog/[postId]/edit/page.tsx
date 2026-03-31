import { notFound } from "next/navigation";
import { getBlogPost } from "../../actions";
import BlogEditor from "./BlogEditor";

export default async function BlogEditPage({
  params,
}: {
  params: { username: string; postId: string };
}) {
  let post;
  try {
    post = await getBlogPost(params.postId);
  } catch {
    notFound();
  }

  return <BlogEditor post={post} />;
}
