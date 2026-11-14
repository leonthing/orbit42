import { cardsMe, cardsError, parseCard } from "@/lib/cards-route";
import { matchCard, candidateView } from "@/lib/cards-google";
import { defaultChoice } from "@/lib/cards-match";

export const dynamic = "force-dynamic";

/** POST { card, recent?: 앱이 최근 만든 resourceName 중 겹치는 것 } → { candidates, suggested } 같은 사람 후보(읽기만, 쓰지 않음) */
export async function POST(request: Request) {
  const a = await cardsMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => null)) as { card?: unknown; recent?: unknown } | null;
  const card = parseCard(body?.card);
  if (!card) return Response.json({ error: "이름을 넣어 주세요." }, { status: 400 });
  try {
    const recent = Array.isArray(body?.recent) ? body!.recent.filter((x): x is string => typeof x === "string").slice(0, 20) : [];
    const cands = await matchCard(a.id, card, recent);
    return Response.json({ candidates: cands.map(candidateView), suggested: defaultChoice(cands) });
  } catch (e) {
    return cardsError(e);
  }
}
