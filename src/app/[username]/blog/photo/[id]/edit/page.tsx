import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoPostEditor } from "@/components/posts/PhotoPostEditor";
import { getPost } from "@/lib/posts";
import { requirePhotoWriter } from "../../access";

export const metadata: Metadata = { title: "글 고치기", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditPhotoPostPage({
  params,
  searchParams,
}: {
  params: { username: string; id: string };
  searchParams: { resumed?: string };
}) {
  const me = await requirePhotoWriter(params.username, `/${params.username}/blog/photo/${params.id}/edit`);
  const r = await getPost(me, params.id);
  if ("error" in r || !r.post.mine) notFound();
  const p = r.post;
  return (
    <PhotoPostEditor
      username={params.username}
      resumed={searchParams.resumed === "1"}
      initial={{
        id: p.id,
        slug: p.slug,
        title: p.title,
        body: p.body,
        isPublic: p.visibility === "public" || !p.publishedAt, // 임시 저장 글은 올릴 때 기본 '전체 공개'
        draft: p.visibility !== "public" && !p.publishedAt,
        photos: p.photos.map((ph) => ({ id: ph.id, url: ph.url, caption: ph.caption })),
      }}
    />
  );
}
