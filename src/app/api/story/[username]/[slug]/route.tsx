import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getSlotBySlug } from "@/lib/slots";
import { storyTemplate } from "@/lib/story-templates";
import { SITE } from "@/lib/constants";
import { storyFonts } from "@/lib/og-font";

export const runtime = "nodejs";

/**
 * 인스타 스토리용 예약 링크 이미지 (1080×1920 PNG).
 *   /api/story/{username}/{slug}?t=indigo|sunset|forest|paper|midnight
 * 공개 예약 페이지에 이미 보이는 정보(호스트·제목·길이·가격·링크)만 쓴다.
 * 인스타 UI 가 위 ~220px·아래 ~340px 를 덮으므로 핵심 내용은 그 안쪽에 둔다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { username: string; slug: string } },
) {
  const found = await getSlotBySlug(params.username, params.slug);
  if (!found || !found.slot.active) {
    return new Response("Not found", { status: 404 });
  }
  const { slot, host } = found;
  const t = storyTemplate(request.nextUrl.searchParams.get("t"));

  const url = `${SITE.url}/${host.username}/s/${slot.slug}`;
  const shortUrl = url.replace(/^https?:\/\//, "");
  const hostName = host.display_name || host.username;
  const price = slot.price_cents > 0 ? `₩${Math.round(slot.price_cents / 100).toLocaleString("ko-KR")}` : "무료";
  const tagline = "DM 대신, 여기서 바로 예약하세요";
  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
    color: { dark: t.qrDark, light: t.qrLight },
  });

  const allText = `${hostName}@${host.username}${slot.title}${slot.duration_min}분${price}${tagline}예약하기→${shortUrl}orbit42 링크로 예약받기`;
  const fonts = await storyFonts(allText);

  const titleSize = slot.title.length > 26 ? 76 : slot.title.length > 16 ? 92 : 108;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(180deg, ${t.from} 0%, ${t.to} 100%)`,
          fontFamily: "KR",
          color: t.text,
          padding: "250px 96px 360px",
        }}
      >
        {/* 호스트 */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {host.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={host.avatar_url}
              width={112}
              height={112}
              style={{ borderRadius: 56, objectFit: "cover", border: `4px solid ${t.accent}` }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: t.pillBg,
                color: t.pillText,
                fontSize: 52,
                fontWeight: 900,
              }}
            >
              {hostName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 700 }}>{hostName}</div>
            <div style={{ fontSize: 32, color: t.sub }}>{`@${host.username}`}</div>
          </div>
        </div>

        {/* 세션 */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 110 }}>
          <div style={{ fontSize: titleSize, fontWeight: 900, lineHeight: 1.12, letterSpacing: -2 }}>
            {slot.title}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 44 }}>
            {[`${slot.duration_min}분`, price].map((c) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  fontSize: 38,
                  fontWeight: 700,
                  padding: "14px 34px",
                  borderRadius: 999,
                  border: `3px solid ${t.accent}`,
                  color: t.text,
                }}
              >
                {c}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: t.sub, marginTop: 56 }}>{tagline}</div>
        </div>

        {/* 예약 카드 */}
        <div style={{ display: "flex", flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            padding: 40,
            borderRadius: 48,
            background: "rgba(255,255,255,0.14)",
            border: `2px solid ${t.accent}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={240} height={240} style={{ borderRadius: 20 }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 22 }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                fontSize: 46,
                fontWeight: 900,
                padding: "18px 44px",
                borderRadius: 999,
                background: t.pillBg,
                color: t.pillText,
              }}
            >
              예약하기 →
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.sub, wordBreak: "break-all" }}>{shortUrl}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 36, fontSize: 30, fontWeight: 700, color: t.sub }}>
          orbit42 · 링크로 예약받기
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts,
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}
