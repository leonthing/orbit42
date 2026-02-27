import type { Metadata } from "next";
import { getAllPosts } from "@/lib/posts";
import { RecentPosts } from "@/components/home/RecentPosts";
import { supabase } from "@/lib/supabase";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: SITE.title,
  },
  description: SITE.description,
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    url: SITE.url,
    type: "website",
  },
};

export default async function Home() {
  const [allPosts, { data: homePage }] = await Promise.all([
    getAllPosts(),
    supabase.from("pages").select("title, content").eq("slug", "home").single(),
  ]);
  const posts = allPosts.slice(0, 5);

  const title = homePage?.title || "";
  const description = homePage?.content || "";

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.title,
    url: SITE.url,
    description: SITE.description,
    author: {
      "@type": "Person",
      name: SITE.author,
    },
  };

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {(title || description) && (
        <section className="py-8">
          {title && (
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-lg text-charcoal-600 dark:text-charcoal-400">
              {description}
            </p>
          )}
        </section>
      )}
      <RecentPosts posts={posts} />
    </div>
  );
}
