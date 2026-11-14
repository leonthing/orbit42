import { apiSession, issuePurposeToken } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { cardsOpenFor } from "@/lib/cards-access";
import { CardsNotConnected } from "@/lib/cards-google";
import type { CardFields } from "@/lib/cards-match";

/** 앱(Bearer) 요청의 사용자 — 허용 목록이 아니면 404(기능이 있다는 것도 안 보이게) */
export async function cardsMe(request: Request): Promise<{ id: string; username: string } | { res: Response }> {
  const s = await apiSession(request);
  if (!s) return { res: Response.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  const { data } = await getAdminClient().from("users").select("id, username").eq("username", s.username).single();
  if (!data || !cardsOpenFor(data.id as string)) return { res: Response.json({ error: "Not found" }, { status: 404 }) };
  return { id: data.id as string, username: data.username as string };
}

export function cardsError(e: unknown): Response {
  if (e instanceof CardsNotConnected)
    return Response.json({ error: "구글 연락처 연결이 필요해요.", code: "not_connected" }, { status: 409 });
  console.error("cards", e);
  const status = Number((e as { code?: number })?.code);
  if (status === 429) return Response.json({ error: "구글이 잠시 바빠요. 조금 뒤에 다시 해 주세요." }, { status: 503 });
  return Response.json({ error: "구글 연락처에 연결하지 못했어요. 잠시 뒤 다시 해 주세요." }, { status: 502 });
}

export const cardStateToken = (username: string) => issuePurposeToken(username, "cards-connect", 600);

const LIMITS: Record<keyof Omit<CardFields, "emails">, number> = {
  name: 80, company: 120, department: 120, title: 80, mobile: 40, workPhone: 40, fax: 40, address: 300, website: 200,
};

/** 앱이 보낸 칸 — 정해진 칸만, 길이 제한. 이름이 없으면 null */
export function parseCard(raw: unknown): CardFields | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (k: keyof typeof LIMITS) => (typeof r[k] === "string" ? (r[k] as string).trim().slice(0, LIMITS[k]) : "");
  const card: CardFields = {
    name: str("name"), company: str("company"), department: str("department"), title: str("title"),
    mobile: str("mobile"), workPhone: str("workPhone"), fax: str("fax"),
    emails: Array.isArray(r.emails)
      ? (r.emails as unknown[]).filter((e): e is string => typeof e === "string" && e.includes("@")).map((e) => e.trim().slice(0, 200)).slice(0, 4)
      : [],
    address: str("address"), website: str("website"),
  };
  return card.name ? card : null;
}
