import { ImageResponse } from "next/og";
import { getPublishedPost } from "../../actions";

export const runtime = "nodejs";
export const alt = "Orbit42 blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { username: string; slug: string };
}) {
  const result = await getPublishedPost(params.username, params.slug).catch(
    () => null,
  );
  const title = result?.post.title || "Orbit42 Blog";
  const authorName =
    result?.author.display_name || result?.author.username || params.username;
  const excerpt =
    (result?.post.excerpt as string | null) ||
    (result?.post.content ? result.post.content.slice(0, 140) : "") ||
    "";
  const publishedAt = result?.post.published_at
    ? new Date(result.post.published_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const coverImage = (result?.post.cover_image as string | null) || null;

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
          position: "relative",
        }}
      >
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
              opacity: 0.35,
            }}
          />
        )}
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
            Blog
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -1,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            maxWidth: 1040,
          }}
        >
          {title}
        </div>

        {excerpt && (
          <div
            style={{
              marginTop: 28,
              fontSize: 26,
              color: "#d4d4d4",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              maxWidth: 1000,
            }}
          >
            {excerpt}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            color: "#a3a3a3",
          }}
        >
          <span style={{ color: "#e5e5e5", fontWeight: 600 }}>{authorName}</span>
          {publishedAt && (
            <>
              <span>·</span>
              <span>{publishedAt}</span>
            </>
          )}
          <span style={{ marginLeft: "auto" }}>orbit42.org</span>
        </div>
      </div>
    ),
    size,
  );
}
