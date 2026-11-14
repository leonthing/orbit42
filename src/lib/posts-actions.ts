"use server";

// 웹 글·사진(1.10.0) — 클라이언트가 부르는 서버 액션만. 세션의 사용자로만 동작하고,
// 허용 여부·공개 여부·차단은 lib/posts 가 다시 확인한다.
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import * as posts from "@/lib/posts";

async function meId(): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  const { data } = await getAdminClient().from("users").select("id").eq("username", s.username).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

const LOGIN = { error: "로그인이 필요해요." } as const;

export async function likePostAction(postId: string, on: boolean) {
  const me = await meId();
  if (!me) return LOGIN;
  return posts.setLike(me, String(postId), !!on);
}

export async function reportPostAction(postId: string, reason: string) {
  const me = await meId();
  if (!me) return LOGIN;
  return posts.reportPost(me, String(postId), String(reason ?? "").slice(0, 500));
}

export async function createPostAction(input: { title?: string; body?: string }) {
  const me = await meId();
  if (!me) return LOGIN;
  // 웹도 앱과 같이 '나만 보기'로 먼저 만들고, 사진을 다 올린 뒤 공개 범위를 정한다
  return posts.createPost(me, { title: input?.title, body: input?.body, public: false });
}

export async function updatePostAction(postId: string, input: { title?: string; body?: string; public?: boolean }) {
  const me = await meId();
  if (!me) return LOGIN;
  return posts.updatePost(me, String(postId), { title: input?.title, body: input?.body, public: input?.public });
}

export async function deletePostAction(postId: string) {
  const me = await meId();
  if (!me) return LOGIN;
  return posts.deletePost(me, String(postId));
}

export async function removePhotoAction(postId: string, photoId: string) {
  const me = await meId();
  if (!me) return LOGIN;
  return posts.removePhoto(me, String(postId), String(photoId));
}

export async function reorderPhotosAction(postId: string, order: string[]) {
  const me = await meId();
  if (!me) return LOGIN;
  return posts.reorderPhotos(me, String(postId), Array.isArray(order) ? order.map(String) : []);
}

/** 사진 한 장(FormData photo) — 브라우저에서 긴 변 2048 JPEG로 줄여 보내고, 서버가 다시 인코딩한다 */
export async function addPhotoAction(postId: string, form: FormData) {
  const me = await meId();
  if (!me) return LOGIN;
  const file = form.get("photo");
  return posts.addPhoto(me, String(postId), file instanceof Blob ? file : null);
}
