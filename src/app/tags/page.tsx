import { Metadata } from "next";
import { getAllTags } from "@/lib/posts";
import { TagBadge } from "@/components/blog/TagBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tags",
  description: "모든 태그 목록",
};

export default async function TagsPage() {
  const tags = await getAllTags();

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-charcoal-900 dark:text-charcoal-100">
        Tags
      </h1>
      <div className="flex flex-wrap gap-3">
        {tags.map(({ tag, count }) => (
          <TagBadge key={tag} tag={tag} count={count} />
        ))}
      </div>
    </div>
  );
}
