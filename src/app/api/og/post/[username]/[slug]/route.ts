import sharp from "sharp";
import { firstPhotoForOg } from "@/lib/posts";

export const dynamic = "force-dynamic";

/**
 * 글·사진(1.10.0) 공유 미리보기 이미지 — 첫 사진을 1200×630 으로 가운데 자른 JPEG.
 * 공개 스위치(POSTS_PUBLIC)가 켜졌고 공개·숨김 아님·사진 있음일 때만, 아니면 404.
 */
export async function GET(_req: Request, { params }: { params: { username: string; slug: string } }) {
  const src = await firstPhotoForOg(params.username, decodeURIComponent(params.slug));
  if (!src) return new Response("Not found", { status: 404 });
  const out = await sharp(src).resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(out), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
