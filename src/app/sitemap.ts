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
    db.from("users").select("username, updated_at").or("is_private.is.null,is_private.eq.false").limit(5000), // 비공개 프로필 제외(lib/profile-privacy)
    db
      .from("time_slots")
      .select("slug, updated_at, host:users!time_slots_host_id_fkey(username, is_private)")
      .eq("active", true)
      .limit(5000),
    db
      .from("blog_posts")
      .select(
        "slug, published_at, user:users!blog_posts_user_id_fkey(username, is_private)",
      )
      .eq("origin", "web") // 앱 글·사진(1.10.0 시험)은 웹 블로그 경로에 내보내지 않는다
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
      const hostArr = s.host as unknown as { username?: string; is_private?: boolean | null } | { username?: string; is_private?: boolean | null }[] | null;
      const host = Array.isArray(hostArr) ? hostArr[0] : hostArr;
      // 비공개 계정의 예약 링크는 동작하지만 검색엔진으로 찾게 하지는 않는다('직접 공유한' 링크)
      if (!host?.username || host.is_private) return null;
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
      const userArr = p.user as unknown as { username?: string; is_private?: boolean | null } | { username?: string; is_private?: boolean | null }[] | null;
      const user = Array.isArray(userArr) ? userArr[0] : userArr;
      if (!user?.username || user.is_private) return null;
      return {
        url: `${base}/blog-public/${user.username}/${p.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        lastModified: p.published_at ? new Date(p.published_at) : now,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // 글·사진(1.10.0): 공개 스위치(POSTS_PUBLIC)가 켜졌을 때만 — 꺼져 있으면 빈 목록
  const { listPublicAppPostsForFeeds } = await import("@/lib/posts");
  const appPostRoutes: MetadataRoute.Sitemap = (await listPublicAppPostsForFeeds())
    .filter((p) => p.username)
    .map((p) => ({
      url: `${base}/${p.username}/blog/${encodeURIComponent(p.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      lastModified: new Date(p.publishedAt),
    }));

  return [...staticRoutes, ...userRoutes, ...slotRoutes, ...postRoutes, ...appPostRoutes];
}
