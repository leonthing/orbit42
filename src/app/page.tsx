import { getAllPosts } from "@/lib/posts";
import { RecentPosts } from "@/components/home/RecentPosts";
import { SITE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [allPosts, { data: homePage }] = await Promise.all([
    getAllPosts(),
    supabase.from("pages").select("title, content").eq("slug", "home").single(),
  ]);
  const posts = allPosts.slice(0, 5);

  const title = homePage?.title || SITE.title;
  const description = homePage?.content || SITE.description;

  return (
    <div className="space-y-12">
      <section className="py-8">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100">
          {title}
        </h1>
        <p className="text-lg text-charcoal-600 dark:text-charcoal-400">
          {description}
        </p>
      </section>
      <RecentPosts posts={posts} />
    </div>
  );
}
