import RSS from "rss";
import { getAllPosts } from "@/lib/posts";
import { SITE } from "@/lib/constants";

export async function GET() {
  const feed = new RSS({
    title: SITE.title,
    description: SITE.description,
    site_url: SITE.url,
    feed_url: `${SITE.url}/feed.xml`,
    language: "ko",
  });

  const posts = await getAllPosts();

  posts.forEach((post) => {
    feed.item({
      title: post.title,
      description: post.description,
      url: `${SITE.url}/blog/${post.slug}`,
      date: new Date(post.date),
      categories: [post.category, ...post.tags],
    });
  });

  return new Response(feed.xml({ indent: true }), {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
