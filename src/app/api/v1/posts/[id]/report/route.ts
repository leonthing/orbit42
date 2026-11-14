import { reportPost } from "@/lib/posts";
import { postJson, postMe } from "@/lib/post-route";

export const dynamic = "force-dynamic";

/** POST { reason? } → { ok } — 운영자 /admin/reports 로, 하루 20건까지 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  return postJson(await reportPost(a.me, params.id, body.reason));
}
