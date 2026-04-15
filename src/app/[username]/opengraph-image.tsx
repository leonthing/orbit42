import { ImageResponse } from "next/og";
import { getProfile } from "@/lib/auth";

export const runtime = "nodejs";
export const alt = "Orbit42 profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  const name = profile?.display_name || profile?.username || "Orbit42";
  const bio = (profile?.bio as string | null) || "";

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
            Profile
          </div>
        </div>

        <div
          style={{
            marginTop: 72,
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 72,
              color: "#fff",
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -1 }}>
              {name}
            </div>
            {profile?.username && (
              <div style={{ fontSize: 28, color: "#a3a3a3", marginTop: 6 }}>
                @{profile.username}
              </div>
            )}
          </div>
        </div>

        {bio && (
          <div
            style={{
              marginTop: 40,
              fontSize: 28,
              color: "#d4d4d4",
              lineHeight: 1.4,
              display: "flex",
              maxWidth: 1000,
            }}
          >
            {bio.length > 160 ? bio.slice(0, 160) + "…" : bio}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            fontSize: 20,
            color: "#a3a3a3",
          }}
        >
          orbit42.org
        </div>
      </div>
    ),
    size,
  );
}
