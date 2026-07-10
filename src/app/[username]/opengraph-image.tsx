import { ImageResponse } from "next/og";
import { getProfile } from "@/lib/auth";
import { getFollowStats } from "@/lib/follows";
import { listPublicSlotsByUsername } from "@/lib/slots";

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
  const username = profile?.username || params.username;
  const bio = (profile?.bio as string | null) || "";
  const avatarUrl = (profile?.avatar_url as string | null) || null;
  const interests = ((profile?.interests || []) as string[]).slice(0, 4);

  const [stats, slots] = profile
    ? await Promise.all([
        getFollowStats(username).catch(() => ({ followers: 0, following: 0 })),
        listPublicSlotsByUsername(username).catch(() => []),
      ])
    : [{ followers: 0, following: 0 }, [] as unknown[]];

  const statChips: { label: string; value: string }[] = [];
  if (stats.followers > 0)
    statChips.push({ label: "orbiters", value: String(stats.followers) });
  if (slots.length > 0)
    statChips.push({ label: "예약 가능 슬롯", value: String(slots.length) });

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
          padding: "64px 80px",
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
            marginTop: 56,
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={150}
              height={150}
              style={{
                width: 150,
                height: 150,
                borderRadius: 75,
                objectFit: "cover",
                border: "4px solid rgba(239, 68, 68, 0.6)",
              }}
            />
          ) : (
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: 75,
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
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -1 }}>
              {name}
            </div>
            <div style={{ fontSize: 28, color: "#a3a3a3" }}>{`@${username}`}</div>
          </div>
        </div>

        {bio && (
          <div
            style={{
              marginTop: 32,
              fontSize: 27,
              color: "#d4d4d4",
              lineHeight: 1.4,
              display: "flex",
              maxWidth: 1000,
            }}
          >
            {bio.length > 140 ? bio.slice(0, 140) + "…" : bio}
          </div>
        )}

        {(statChips.length > 0 || interests.length > 0) && (
          <div
            style={{
              marginTop: 32,
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            {statChips.map((chip) => (
              <div
                key={chip.label}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  padding: "10px 22px",
                  borderRadius: 999,
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                }}
              >
                <span style={{ fontSize: 26, fontWeight: 800, color: "#f87171" }}>
                  {chip.value}
                </span>
                <span style={{ fontSize: 20, color: "#d4d4d4" }}>
                  {chip.label}
                </span>
              </div>
            ))}
            {interests.map((tag) => (
              <div
                key={tag}
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  fontSize: 20,
                  color: "#e5e5e5",
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            fontSize: 20,
            color: "#a3a3a3",
          }}
        >
          {`orbit42.org/${username}`}
        </div>
      </div>
    ),
    size,
  );
}
