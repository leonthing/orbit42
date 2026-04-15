import { ImageResponse } from "next/og";
import { getSlotBySlug } from "@/lib/slots";

export const runtime = "nodejs";
export const alt = "Orbit42 timeslot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { username: string; slug: string };
}) {
  const data = await getSlotBySlug(params.username, params.slug);
  const title = data?.slot.title ?? "Orbit42 timeslot";
  const hostName = data?.host.display_name || data?.host.username || "Orbit42";
  const handle = data?.host.username ?? "";
  const slot = data?.slot;
  const isAuction = slot?.pricing_model === "auction";
  const priceLabel = !slot
    ? ""
    : isAuction
      ? `경매 · 시작가 ₩${((slot.reserve_price_cents ?? 0) / 100).toLocaleString("ko-KR")}`
      : slot.price_cents === 0
        ? "무료"
        : `₩${(slot.price_cents / 100).toLocaleString("ko-KR")}`;
  const duration = slot?.duration_min ? `${slot.duration_min}분` : "";
  const meta = [duration, priceLabel].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0a0a0f 0%, #1a0606 70%, #3a0a0a 100%)",
          color: "#fff",
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 26,
              color: "#fff",
            }}
          >
            O
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "#e5e5e5" }}>
            Orbit42
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#f87171",
            }}
          >
            Timeslot
          </div>
        </div>

        <div
          style={{
            marginTop: 64,
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -1,
            display: "flex",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        {meta && (
          <div
            style={{
              marginTop: 28,
              fontSize: 28,
              color: "#fca5a5",
              fontWeight: 600,
            }}
          >
            {meta}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 28,
              color: "#fff",
            }}
          >
            {(hostName || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>
              {hostName}
            </div>
            {handle && (
              <div style={{ fontSize: 20, color: "#a3a3a3", marginTop: 2 }}>
                @{handle}
              </div>
            )}
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 20,
              color: "#a3a3a3",
            }}
          >
            orbit42.org
          </div>
        </div>
      </div>
    ),
    size,
  );
}
