import { apiUserId } from "@/lib/api-auth";
import type { PostErr } from "@/lib/posts";

// 시험 기간: 허용 목록 밖이면 404(기능이 있다는 것도 드러내지 않음)
const STATUS: Record<string, number> = { closed: 404, not_found: 404, limit: 429, invalid: 400, forbidden: 403 };

export async function postMe(request: Request): Promise<{ me: string } | { res: Response }> {
  const me = await apiUserId(request);
  if (!me) return { res: Response.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  return { me };
}

export const noStore = { headers: { "Cache-Control": "no-store" } };

export function postJson<T extends object>(r: T | PostErr): Response {
  if ("error" in r) {
    const code = (r as PostErr).code;
    return Response.json(code === "closed" ? { error: "Not found" } : r, { status: STATUS[code ?? ""] ?? 500 });
  }
  return Response.json(r, noStore);
}
