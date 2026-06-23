import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Fetch a Korean-capable static font (subset to just the glyphs we render)
 * from Google Fonts. next/og's renderer (satori) can't read variable or
 * woff2 fonts — the legacy User-Agent makes Google serve a plain TTF/woff,
 * and `text=` keeps the download tiny. Returns null on any failure so the
 * card still renders (Latin) instead of 500-ing.
 */
async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(
      text,
    )}`;
    const css = await fetch(url, {
      headers: {
        // Old Safari → Google serves a non-woff2 font satori can parse.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.59.10 (KHTML, like Gecko) Version/5.1.9 Safari/534.59.10",
      },
    }).then((r) => r.text());
    const src = css.match(/src:\s*url\(([^)]+)\)/);
    if (!src) return null;
    return await fetch(src[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Shareable "내 시간 자산" card. All numbers come from query params the
 * owner chose to share — the route reads no private data.
 *   /api/time-card?name=Leo&hours=12.5&value=480000&rate=38400&week=6월 2주
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const name = (p.get("name") || "Orbit42").slice(0, 40);
  const hours = (p.get("hours") || "0").slice(0, 12);
  const valueNum = Number(p.get("value") || "0");
  const rateNum = Number(p.get("rate") || "0");
  const week = (p.get("week") || "").slice(0, 30);

  const fmtWon = (n: number) =>
    n > 0 ? `₩${Math.round(n).toLocaleString("ko-KR")}` : "—";

  // Every glyph the card might render, so the font subset covers them all.
  const glyphs =
    `${name}${week}${hours}${fmtWon(valueNum)}${fmtWon(rateNum)}` +
    "내 시간 자산거래된 누적액당 가치를 으로 OrbitTimeAsset ₩h·—,. 0123456789";
  const koreanFont = await loadKoreanFont(glyphs);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0a0a0f 0%, #14060a 65%, #3a0a0a 100%)",
          color: "#fff",
          padding: "64px 72px",
          fontFamily:
            "'Noto Sans KR', system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 24,
              color: "#fff",
            }}
          >
            O
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#e5e5e5" }}>
            Orbit42
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#f87171",
            }}
          >
            Time Asset
          </div>
        </div>

        <div
          style={{
            marginTop: 52,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            fontSize: 34,
            color: "#d4d4d4",
          }}
        >
          <span style={{ color: "#fff", fontWeight: 800 }}>{name}</span>
          <span>{`의 시간 자산${week ? ` · ${week}` : ""}`}</span>
        </div>

        <div
          style={{
            marginTop: 44,
            display: "flex",
            gap: 24,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "28px 32px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <div style={{ fontSize: 20, color: "#a3a3a3" }}>거래된 시간</div>
            <div style={{ marginTop: 8, fontSize: 52, fontWeight: 800 }}>
              {`${hours}h`}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "28px 32px",
              borderRadius: 20,
              background: "rgba(220,38,38,0.14)",
              border: "1px solid rgba(248,113,113,0.45)",
            }}
          >
            <div style={{ fontSize: 20, color: "#fca5a5" }}>누적 거래액</div>
            <div style={{ marginTop: 8, fontSize: 52, fontWeight: 800 }}>
              {fmtWon(valueNum)}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "28px 32px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <div style={{ fontSize: 20, color: "#a3a3a3" }}>시간당 가치</div>
            <div style={{ marginTop: 8, fontSize: 52, fontWeight: 800 }}>
              {fmtWon(rateNum)}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            color: "#a3a3a3",
          }}
        >
          <span>내 시간을 자산으로 — </span>
          <span style={{ color: "#f87171", fontWeight: 700, marginLeft: 8 }}>
            orbit42.org
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: koreanFont
        ? [
            {
              name: "Noto Sans KR",
              data: koreanFont,
              weight: 700,
              style: "normal",
            },
          ]
        : undefined,
      headers: { "cache-control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
