/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Raised from the 1 MB default so that image uploads (avatars, blog,
    // feed, slot photos) don't blow up before reaching the server action.
    // Client-side resizing keeps most payloads well under 1 MB anyway —
    // this is defense-in-depth.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      // 게스트 예약 관리 (개선-40) — 다른 사이트로 주소가 새지 않게, 검색에도 안 나오게
      {
        source: "/b",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
