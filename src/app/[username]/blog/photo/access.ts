// 글·사진 쓰기 화면(1.10.0) 공통 확인 — 본인 주소이고 글·사진을 쓸 수 있는 계정만(시험 기간 허용 목록)
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { postsOpenFor } from "@/lib/posts-access";

export async function requirePhotoWriter(username: string, next: string): Promise<string> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (session.username !== username) notFound();
  const { data } = await getAdminClient().from("users").select("id").eq("username", username).maybeSingle();
  const me = (data?.id as string | undefined) ?? null;
  if (!me || !postsOpenFor(me)) notFound();
  return me;
}
