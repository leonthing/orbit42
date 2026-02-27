import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { compilePost } from "@/lib/mdx";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.author}에 대해`,
};

export default async function AboutPage() {
  const { data } = await supabase
    .from("pages")
    .select("content")
    .eq("slug", "about")
    .single();

  const content = data?.content;

  if (!content) {
    return (
      <div className="py-10 text-center text-charcoal-500 dark:text-charcoal-400">
        아직 About 페이지가 작성되지 않았습니다.
      </div>
    );
  }

  const compiled = await compilePost(content);

  return (
    <article className="prose prose-charcoal max-w-none dark:prose-invert">
      {compiled}
    </article>
  );
}
