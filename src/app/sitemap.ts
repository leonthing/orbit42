import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { getAdminClient } from "@/lib/supabase";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1, lastModified: now },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.8, lastModified: now },
    { url: `${base}/blog-public`, changeFrequency: "daily", priority: 0.7, lastModified: now },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
  ];

  const db = getAdminClient();
  const [users, slots, posts] = await Promise.all([
    db.from("users").select("username, updated_at").limit(5000),
    db
      .from("time_slots")
      .select("slug, updated_at, host:users!time_slots_host_id_fkey(username)")
      .eq("active", true)
      .limit(5000),
    db
      .from("blog_posts")
      .select(
        "slug, published_at, user:users!blog_posts_user_id_fkey(username)",
      )
      .eq("published", true)
      .limit(5000),
  ]);

  const userRoutes: MetadataRoute.Sitemap = (users.data ?? []).flatMap((u) => {
    const lastmod = u.updated_at ? new Date(u.updated_at) : now;
    return [
      {
        url: `${base}/${u.username}`,
        changeFrequency: "weekly" as const,
        priority: 0.9,
        lastModified: lastmod,
      },
      {
        url: `${base}/${u.username}/slots`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
        lastModified: lastmod,
      },
      {
        url: `${base}/${u.username}/services`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        lastModified: lastmod,
      },
    ];
  });

  const slotRoutes: MetadataRoute.Sitemap = (slots.data ?? [])
    .map((s) => {
      const hostArr = s.host as unknown as { username?: string } | { username?: string }[] | null;
      const host = Array.isArray(hostArr) ? hostArr[0] : hostArr;
      if (!host?.username) return null;
      return {
        url: `${base}/${host.username}/s/${s.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
        lastModified: s.updated_at ? new Date(s.updated_at) : now,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const postRoutes: MetadataRoute.Sitemap = (posts.data ?? [])
    .map((p) => {
      const userArr = p.user as unknown as { username?: string } | { username?: string }[] | null;
      const user = Array.isArray(userArr) ? userArr[0] : userArr;
      if (!user?.username) return null;
      return {
        url: `${base}/blog-public/${user.username}/${p.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        lastModified: p.published_at ? new Date(p.published_at) : now,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return [...staticRoutes, ...userRoutes, ...slotRoutes, ...postRoutes];
}
