import { listDm, startDm } from "@/lib/dm";
import { dmError, dmMe, noStore } from "@/lib/dm-route";

export const dynamic = "force-dynamic";

/**
 * 1:1 대화 (1.9.0) — 웹(쿠키)·앱(Bearer).
 * GET  → { items: DmSummary[], requests: DmSummary[] (받은 요청), unread }
 * POST { username, body? } → 바로 대화면 { id, view:'open' }, 요청이면 첫 글 body 필요(없으면 409 needsRequest) → { id, view:'pending' }
 */
export async function GET() {
  const a = await dmMe();
  if ("res" in a) return a.res;
  const { items, requests } = await listDm(a.me);
  return Response.json({ items, requests, unread: items.filter((i) => i.unread).length + requests.length }, noStore);
}

export async function POST(request: Request) {
  const a = await dmMe();
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; body?: unknown };
  if (typeof body.username !== "string" || !body.username) return Response.json({ error: "상대를 골라 주세요." }, { status: 400 });
  const r = await startDm(a.me, body.username, typeof body.body === "string" ? body.body : null);
  if ("error" in r) return dmError(r);
  return Response.json(r);
}
