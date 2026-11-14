import { NextResponse } from "next/server";
import { getPublishedPosts } from "../../actions";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripMarkdown(md: string, max = 300) {
  const text = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>~]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function GET(
  _request: Request,
  { params }: { params: { username: string } },
) {
  const result = await getPublishedPosts(params.username);
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { author, posts } = result;
  const name = author.display_name || author.username;
  const blogUrl = `${SITE.url}/blog-public/${author.username}`;
  const lastBuild = posts[0]?.published_at
    ? new Date(posts[0].published_at).toUTCString()
    : new Date().toUTCString();

  // 글·사진(1.10.0): 공개 스위치가 켜졌을 때만 함께 싣는다(꺼져 있으면 빈 목록)
  const { getAdminClient } = await import("@/lib/supabase");
  const { listPublicAppPostsForFeeds } = await import("@/lib/posts");
  const { data: au } = await getAdminClient().from("users").select("id").eq("username", author.username).maybeSingle();
  const appItems = au ? await listPublicAppPostsForFeeds(au.id as string, 20) : [];
  const appXml = appItems.map((p) => {
    const link = `${SITE.url}/${author.username}/blog/${encodeURIComponent(p.slug)}`;
    return `    <item>
      <title>${escapeXml(p.title || `${name}님의 사진`)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(p.body.slice(0, 300))}</description>
    </item>`;
  });

  const items = posts
    .slice(0, 20)
    .map((post) => {
      const link = `${blogUrl}/${encodeURIComponent(post.slug)}`;
      const description = post.excerpt || stripMarkdown(post.content);
      const categories = post.tags
        .map((t) => `<category>${escapeXml(t)}</category>`)
        .join("");
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
      ${categories}
    </item>`;
    })
    .concat(appXml)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${name} · ${SITE.title}`)}</title>
    <link>${escapeXml(blogUrl)}</link>
    <atom:link href="${escapeXml(`${blogUrl}/rss.xml`)}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(author.bio || `${name}의 글`)}</description>
    <language>ko</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
