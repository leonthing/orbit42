import sharp from "sharp";
import { ImageResponse } from "next/og";
import { ogDataForPost } from "@/lib/posts";
import { storyFonts } from "@/lib/og-font";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 본문 마크다운 기호를 빼고 한 줄로 */
function plain(md: string): string {
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 글·사진(1.10.0) 공유 미리보기 1200×630 — 대표(첫) 사진 위에 제목. 사진이 없으면 제목 카드.
 * 공개 스위치(POSTS_PUBLIC)가 켜졌고 공개·숨김 아님일 때만, 아니면 404.
 */
export async function GET(_req: Request, { params }: { params: { username: string; slug: string } }) {
  const d = await ogDataForPost(params.username, decodeURIComponent(params.slug));
  if (!d) return new Response("Not found", { status: 404 });
  const title = d.title || (d.photo ? "" : plain(d.body).slice(0, 60)) || `${d.authorName}님의 글`;
  const excerpt = d.title && !d.photo ? plain(d.body).slice(0, 110) : "";
  const bg = d.photo
    ? `data:image/jpeg;base64,${(await sharp(d.photo).resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()).toString("base64")}`
    : null;
  const fonts = await storyFonts(`${title}${excerpt}${d.authorName}orbit42.org·`);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          padding: "64px 72px",
          color: "#fff",
          fontFamily: "KR",
          background: bg ? "#000" : "linear-gradient(135deg, #0b1220 0%, #13213d 60%, #1d3461 100%)",
        }}
      >
        {bg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />
        )}
        {bg && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 360, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%)" }} />
        )}
        {title && (
          <div style={{ display: "flex", fontSize: bg ? 54 : 64, fontWeight: 900, lineHeight: 1.2, maxWidth: 1050, overflow: "hidden", maxHeight: bg ? 140 : 240 }}>
            {title}
          </div>
        )}
        {excerpt && <div style={{ display: "flex", marginTop: 20, fontSize: 28, fontWeight: 700, color: "#cbd5e1", lineHeight: 1.4, maxHeight: 120, overflow: "hidden" }}>{excerpt}</div>}
        <div style={{ display: "flex", marginTop: 28, fontSize: 26, fontWeight: 700, color: "#e2e8f0" }}>
          <span>{d.authorName}</span>
          <span style={{ marginLeft: "auto", color: "#94a3b8" }}>orbit42.org</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
