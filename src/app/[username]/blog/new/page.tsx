import { redirect } from "next/navigation";
import { createBlogPost } from "../actions";

export default async function NewBlogPostPage({
  params,
}: {
  params: { username: string };
}) {
  const post = await createBlogPost();
  redirect(`/${params.username}/blog/${post.id}/edit`);
}
