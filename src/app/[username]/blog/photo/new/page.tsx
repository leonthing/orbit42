import type { Metadata } from "next";
import { PhotoPostEditor } from "@/components/posts/PhotoPostEditor";
import { requirePhotoWriter } from "../access";

export const metadata: Metadata = { title: "새 글", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewPhotoPostPage({ params }: { params: { username: string } }) {
  await requirePhotoWriter(params.username, `/${params.username}/blog/photo/new`);
  return <PhotoPostEditor username={params.username} />;
}
