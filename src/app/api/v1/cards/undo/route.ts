import { cardsMe, cardsError } from "@/lib/cards-route";
import { undoCard } from "@/lib/cards-google";
import { parseUndo } from "@/lib/cards-match";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST { undo } — 저장 응답의 undo 를 그대로(앱이 기기에만 최근 10건 보관).
 * → 200 { ok:true } | 409 { reason:"changed" } (그 사이 고쳐져서 손대지 않음)
 */
export async function POST(request: Request) {
  const a = await cardsMe(request);
  if ("res" in a) return a.res;
  const text = await request.text().catch(() => "");
  if (text.length > 100_000) return Response.json({ error: "보낸 내용이 너무 커요." }, { status: 413 });
  let body: { undo?: unknown } | null = null;
  try { body = JSON.parse(text); } catch { body = null; }
  const undo = parseUndo(body?.undo);
  if (!undo) return Response.json({ error: "되돌릴 내용을 읽지 못했어요." }, { status: 400 });
  try {
    const r = await undoCard(a.id, undo);
    if (!r.ok)
      return Response.json(
        { error: "저장한 뒤에 이 연락처가 바뀌어서 되돌리지 않았어요. 구글 연락처에서 직접 확인해 주세요.", reason: r.reason },
        { status: 409 },
      );
    return Response.json({ ok: true });
  } catch (e) {
    return cardsError(e);
  }
}
