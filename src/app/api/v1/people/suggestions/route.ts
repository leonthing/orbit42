import { apiUserId } from "@/lib/api-auth";
import { resolveSuggestions } from "@/lib/people";

export const dynamic = "force-dynamic";

// POST — 제안 처리 { ids: string[], action: "accept" | "dismiss" }
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown; action?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (body.action !== "accept" && body.action !== "dismiss") {
    return Response.json({ error: "action 이 올바르지 않아요." }, { status: 400 });
  }
  await resolveSuggestions(userId, ids, body.action);
  return Response.json({ ok: true });
}
