import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

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
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
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

        <div style={{ marginTop: 52, fontSize: 34, color: "#d4d4d4" }}>
          <span style={{ color: "#fff", fontWeight: 800 }}>{name}</span>
          <span>의 시간 자산{week ? ` · ${week}` : ""}</span>
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
              {hours}h
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
    { width: 1200, height: 630 },
  );
}
