import { getSession } from "@/lib/auth";
import { userIdOf } from "@/lib/dm";

/** v1 API 공통: 로그인한 사람의 id, 아니면 401 응답 */
export async function dmMe(): Promise<{ me: string } | { res: Response }> {
  const session = await getSession();
  if (!session) return { res: Response.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  const me = await userIdOf(session.username);
  if (!me) return { res: Response.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  return { me };
}

const STATUS: Record<string, number> = {
  closed: 403,
  not_found: 404,
  blocked: 403,
  self: 400,
  needs_request: 409,
  daily_limit: 429,
  rate: 429,
  pending: 409,
  not_incoming: 409,
  own: 400,
};

/** { error, code } → 알맞은 상태 코드 */
export function dmError(r: { error: string; code?: string; needsRequest?: boolean }): Response {
  return Response.json(r, { status: STATUS[r.code ?? ""] ?? 400 });
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
