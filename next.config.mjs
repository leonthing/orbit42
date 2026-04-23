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
    ];
  },
};

export default nextConfig;
