import { followUpsOf, linkFollowUp, unlinkFollowUp } from "@/lib/todos";
import { noStore, todoError, todoMe } from "@/lib/todo-route";

export const dynamic = "force-dynamic";

/**
 * 후속 일정·할 일 연결 (1.9.0)
 * GET ?key=<일정 id> → { source: 원래 일정 | {key, missing:true} | null, followUps: [{kind:'event'…}|{kind:'todo'…}] }
 *   제목·시각은 이때 읽어 온다(저장하지 않음). 못 찾은 연결은 정리한다.
 * POST { sourceKey, targetKey } → 이미 있는 일정을 후속으로 연결
 * DELETE { sourceKey, targetKey } → 연결만 끊기
 */
export async function GET(request: Request) {
  const a = await todoMe(request);
  if ("res" in a) return a.res;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key) return Response.json({ error: "일정을 골라 주세요." }, { status: 400 });
  const r = await followUpsOf(a.me, key);
  if ("error" in r) return todoError(r);
  return Response.json(r, noStore);
}

async function keys(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { sourceKey?: unknown; targetKey?: unknown };
  return typeof b.sourceKey === "string" && typeof b.targetKey === "string" ? { s: b.sourceKey, t: b.targetKey } : null;
}

export async function POST(request: Request) {
  const a = await todoMe(request);
  if ("res" in a) return a.res;
  const k = await keys(request);
  if (!k) return Response.json({ error: "연결할 일정을 골라 주세요." }, { status: 400 });
  const r = await linkFollowUp(a.me, k.s, k.t);
  if ("error" in r) return todoError(r);
  return Response.json(r);
}

export async function DELETE(request: Request) {
  const a = await todoMe(request);
  if ("res" in a) return a.res;
  const k = await keys(request);
  if (!k) return Response.json({ error: "연결할 일정을 골라 주세요." }, { status: 400 });
  const r = await unlinkFollowUp(a.me, k.s, k.t);
  if ("error" in r) return todoError(r);
  return Response.json(r);
}
