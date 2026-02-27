import { getAllPosts } from "@/lib/posts";
import { RecentPosts } from "@/components/home/RecentPosts";
import { SITE } from "@/lib/constants";

export default function Home() {
  const posts = getAllPosts().slice(0, 5);

  return (
    <div className="space-y-12">
      <section className="py-8">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100">
          {SITE.title}
        </h1>
        <p className="text-lg text-charcoal-600 dark:text-charcoal-400">
          {SITE.description}
        </p>
      </section>
      <RecentPosts posts={posts} />
    </div>
  );
}
