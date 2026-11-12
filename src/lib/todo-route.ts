import { apiUserId } from "@/lib/api-auth";

const STATUS: Record<string, number> = { closed: 403, not_found: 404, limit: 429 };

export async function todoMe(request: Request): Promise<{ me: string } | { res: Response }> {
  const me = await apiUserId(request);
  if (!me) return { res: Response.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  return { me };
}

export function todoError(r: { error: string; code?: string }): Response {
  return Response.json(r, { status: STATUS[r.code ?? ""] ?? 400 });
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
