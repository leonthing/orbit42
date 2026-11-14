import { deletePost, getPost, updatePost } from "@/lib/posts";
import { postJson, postMe } from "@/lib/post-route";

export const dynamic = "force-dynamic";

/** GET → { post }(사진 전부 + bookingUrl) · PATCH { title?, body?, public? } → { post } · DELETE → { ok }(사진 파일까지) */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  return postJson(await getPost(a.me, params.id));
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return postJson(await updatePost(a.me, params.id, body));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  return postJson(await deletePost(a.me, params.id));
}
