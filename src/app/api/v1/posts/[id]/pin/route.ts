import { setPinnedPost } from "@/lib/posts";
import { postJson, postMe } from "@/lib/post-route";

export const dynamic = "force-dynamic";

/** PUT → { ok, pinnedPostId } 링크 페이지 맨 위에 고정(내 공개 글만, 하나만) · DELETE → 고정 풀기(이 글이 고정돼 있을 때만) */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  return postJson(await setPinnedPost(a.me, params.id));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  return postJson(await setPinnedPost(a.me, null));
}
