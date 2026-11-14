import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { postsOpenFor } from "@/lib/posts-access";
import type { BlogPost } from "../actions";
import BlogEditor from "../[postId]/edit/BlogEditor";

/**
 * 새 글. 1.10.0 통합: 글·사진을 쓸 수 있는 계정은 글·사진 편집기로만.
 * 그 밖의 계정은 옛 편집기를 빈 상태로 열고, 처음 저장할 때 글을 만든다(열기만 해도 빈 글이 생기지 않게 — PO 11/14).
 */
export default async function NewBlogPostPage({ params }: { params: { username: string } }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/${params.username}/blog/new`)}`);
  if (session.username !== params.username) redirect(`/${session.username}/blog/new`);
  const { data } = await getAdminClient().from("users").select("id").eq("username", session.username).maybeSingle();
  const uid = (data?.id as string | undefined) ?? "";
  if (postsOpenFor(uid || null)) redirect(`/${session.username}/blog/photo/new`);
  const now = new Date().toISOString();
  const blank: BlogPost = {
    id: "",
    user_id: uid,
    slug: "",
    title: "",
    content: "",
    excerpt: null,
    cover_image: null,
    published: false,
    published_at: null,
    tags: [],
    social_x: null,
    social_facebook: null,
    social_linkedin: null,
    created_at: now,
    updated_at: now,
  };
  return <BlogEditor post={blank} />;
}
