import { cardsMe, cardsError } from "@/lib/cards-route";
import { cardStatus, warmupSearch } from "@/lib/cards-google";

export const dynamic = "force-dynamic";

/** GET → { connected, email } — 앱이 명함 화면을 열 때. 연결돼 있으면 검색 색인도 깨운다 */
export async function GET(request: Request) {
  const a = await cardsMe(request);
  if ("res" in a) return a.res;
  try {
    const s = await cardStatus(a.id);
    if (s.connected) await warmupSearch(a.id).catch(() => undefined);
    return Response.json(s);
  } catch (e) {
    return cardsError(e);
  }
}
