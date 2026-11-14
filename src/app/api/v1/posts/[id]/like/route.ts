import { setLike } from "@/lib/posts";
import { postJson, postMe } from "@/lib/post-route";

export const dynamic = "force-dynamic";

/** POST → ❤️ 누르기, DELETE → 취소. { liked, likeCount } */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  return postJson(await setLike(a.me, params.id, true));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  return postJson(await setLike(a.me, params.id, false));
}
