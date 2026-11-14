import { removePhoto, setPhotoCaption } from "@/lib/posts";
import { postJson, postMe } from "@/lib/post-route";

export const dynamic = "force-dynamic";

/** DELETE → { ok } — 행과 파일을 바로 지우고 뒤 사진을 앞으로 당긴다 */
export async function DELETE(request: Request, { params }: { params: { id: string; photoId: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  return postJson(await removePhoto(a.me, params.id, params.photoId));
}

/** PATCH { caption: string | null } → { ok, caption } — 사진 설명(200자, 빈 글자면 지움) */
export async function PATCH(request: Request, { params }: { params: { id: string; photoId: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return postJson(await setPhotoCaption(a.me, params.id, params.photoId, body.caption ?? null));
}
