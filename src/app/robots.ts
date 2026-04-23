import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/messages",
          "/messages/",
          "/notifications",
          "/notifications/",
          "/*/settings",
          "/*/bookings",
          "/*/insights",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/signup",
          "/login",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
