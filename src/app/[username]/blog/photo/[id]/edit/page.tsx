import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoPostEditor } from "@/components/posts/PhotoPostEditor";
import { getPost } from "@/lib/posts";
import { requirePhotoWriter } from "../../access";

export const metadata: Metadata = { title: "글 고치기", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditPhotoPostPage({ params }: { params: { username: string; id: string } }) {
  const me = await requirePhotoWriter(params.username, `/${params.username}/blog/photo/${params.id}/edit`);
  const r = await getPost(me, params.id);
  if ("error" in r || !r.post.mine) notFound();
  const p = r.post;
  return (
    <PhotoPostEditor
      username={params.username}
      initial={{
        id: p.id,
        slug: p.slug,
        title: p.title,
        body: p.body,
        isPublic: p.visibility === "public",
        photos: p.photos.map((ph) => ({ id: ph.id, url: ph.url, caption: ph.caption })),
      }}
    />
  );
}
