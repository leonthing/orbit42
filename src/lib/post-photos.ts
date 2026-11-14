// 일반 서버 모듈 — 글·사진(1.10.0)의 사진 파일 처리. 버킷 post-photos 는 비공개라 서명 URL로만 연다.
// 모든 업로드를 서버에서 다시 인코딩한다(클라이언트를 믿지 않음): 방향 맞춤 → 긴 변 2048 이하 → JPEG.
// sharp 는 withMetadata 를 부르지 않으면 EXIF·GPS·ICC 외 메타데이터를 넣지 않는다.
import sharp from "sharp";
import { getAdminClient } from "@/lib/supabase";

export const POST_PHOTO_BUCKET = "post-photos";
export const POST_PHOTO_MAX_BYTES = 4 * 1024 * 1024; // 서버가 받는 한 장 (기기에서 먼저 줄여 올림)
export const POST_PHOTO_MAX_SIDE = 2048;
export const POST_PHOTO_SIGN_SEC = 60 * 60; // 서명 URL 1시간

export type EncodedPhoto = { data: Buffer; width: number; height: number; bytes: number };

/** 사진을 다시 인코딩한다. 그림이 아니거나 너무 크면(픽셀 폭탄) 오류. */
export async function reencodePhoto(input: Buffer): Promise<EncodedPhoto> {
  const img = sharp(input, { failOn: "error", limitInputPixels: 80_000_000, animated: false });
  const { data, info } = await img
    .rotate() // EXIF 방향대로 돌린 뒤 방향 값은 버린다
    .resize(POST_PHOTO_MAX_SIDE, POST_PHOTO_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }) // 투명 PNG → 흰 바탕
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, bytes: data.length };
}

export async function signPhotoUrls(keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  const { data, error } = await getAdminClient().storage.from(POST_PHOTO_BUCKET).createSignedUrls(keys, POST_PHOTO_SIGN_SEC);
  if (error) {
    console.error("[posts] sign", error.message);
    return out;
  }
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

export async function removePhotoFiles(keys: string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  const { error } = await getAdminClient().storage.from(POST_PHOTO_BUCKET).remove(keys);
  if (error) console.error("[posts] remove files", error.message);
  return !error;
}

/** 한 폴더(<uid>/<postId>) 아래 파일을 모두 지운다 — 행이 없는 파일(업로드 중 실패 등)까지 */
export async function removePhotoFolder(prefix: string): Promise<number> {
  const db = getAdminClient();
  let removed = 0;
  for (;;) {
    const { data, error } = await db.storage.from(POST_PHOTO_BUCKET).list(prefix, { limit: 1000 });
    if (error) throw error;
    const keys = (data ?? []).filter((o) => o.id).map((o) => `${prefix}/${o.name}`);
    if (keys.length === 0) break;
    const { error: rmErr } = await db.storage.from(POST_PHOTO_BUCKET).remove(keys);
    if (rmErr) throw rmErr;
    removed += keys.length;
    if (keys.length < 1000) break;
  }
  return removed;
}
