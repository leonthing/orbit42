import { acceptDm, blockFromDm, declineDm, getDm, leaveDm, reportDm, sendDm } from "@/lib/dm";
import { dmError, dmMe, noStore } from "@/lib/dm-route";

export const dynamic = "force-dynamic";

/**
 * GET ?since=ISO → { id, view, peer, canWrite, reason, messages } (열면 읽음 처리)
 * POST { body } → 보내기(받은 요청에 답하면 수락)
 * PATCH { action: 'read'|'accept'|'decline'|'leave'|'block'|'report', messageId?, reason? }
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await dmMe();
  if ("res" in a) return a.res;
  const since = new URL(req.url).searchParams.get("since");
  const r = await getDm(a.me, params.id, { since });
  if ("error" in r) return dmError(r);
  return Response.json(r, noStore);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const a = await dmMe();
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as { body?: unknown };
  const r = await sendDm(a.me, params.id, body.body);
  if ("error" in r) return dmError(r);
  return Response.json(r);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const a = await dmMe();
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; messageId?: unknown; reason?: unknown };
  let r: { ok: true } | { error: string; code?: string };
  switch (body.action) {
    case "read": {
      const t = await getDm(a.me, params.id, { since: new Date().toISOString() });
      r = "error" in t ? t : { ok: true };
      break;
    }
    case "accept":
      r = await acceptDm(a.me, params.id);
      break;
    case "decline":
      r = await declineDm(a.me, params.id);
      break;
    case "leave":
      r = await leaveDm(a.me, params.id);
      break;
    case "block":
      r = await blockFromDm(a.me, params.id);
      break;
    case "report":
      if (typeof body.messageId !== "string") return Response.json({ error: "신고할 메시지를 골라 주세요." }, { status: 400 });
      r = await reportDm(a.me, params.id, body.messageId, typeof body.reason === "string" ? body.reason : null);
      break;
    default:
      return Response.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
  }
  if ("error" in r) return dmError(r);
  return Response.json({ ok: true });
}
