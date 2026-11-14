import { addPhoto, reorderPhotos } from "@/lib/posts";
import { postJson, postMe } from "@/lib/post-route";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST multipart(photo=파일, 한 장 4MB까지) → { photo } — 서버에서 다시 인코딩(긴 변 2048, JPEG, EXIF·GPS 없음)
 * PUT { order: [photoId…] } → { post } — 글의 사진 전부를 원하는 순서로
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  return postJson(await addPhoto(a.me, params.id, file instanceof Blob ? file : null));
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as { order?: unknown };
  return postJson(await reorderPhotos(a.me, params.id, body.order));
}
