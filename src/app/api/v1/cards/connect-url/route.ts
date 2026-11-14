import { cardsMe, cardStateToken } from "@/lib/cards-route";
import { getCardAuthUrl } from "@/lib/cards-google";

export const dynamic = "force-dynamic";

/** GET → { url } 명함용 구글 권한(연락처·drive.file) 묻기. state = cards:<10분 단일목적 토큰>:app */
export async function GET(request: Request) {
  const a = await cardsMe(request);
  if ("res" in a) return a.res;
  return Response.json({ url: getCardAuthUrl(`cards:${await cardStateToken(a.username)}:app`) });
}
