import { createPost, listPosts } from "@/lib/posts";
import { postJson, postMe } from "@/lib/post-route";

export const dynamic = "force-dynamic";

/**
 * 글·사진 (1.10.0, 시험 기간 내부 계정만)
 * GET ?user=<username>&before=<ISO> → { posts, nextBefore } (user 없으면 내 글 전부, 있으면 그 사람의 공개 글)
 *   목록은 첫 사진만 서명 URL(1시간). photoCount 로 장수.
 * POST { title?, body?, public? } → { post } — 앱은 public:false 로 만들고 사진을 올린 뒤 PATCH public:true
 */
export async function GET(request: Request) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  const url = new URL(request.url);
  return postJson(await listPosts(a.me, { username: url.searchParams.get("user"), before: url.searchParams.get("before") }));
}

export async function POST(request: Request) {
  const a = await postMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return postJson(await createPost(a.me, body));
}
