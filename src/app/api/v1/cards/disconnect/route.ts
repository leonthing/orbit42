import { cardsMe, cardsError } from "@/lib/cards-route";
import { disconnectCards } from "@/lib/cards-google";

export const dynamic = "force-dynamic";

/** POST { revokeAll?: boolean } — 기본은 Orbit42 의 명함 토큰만 지움. revokeAll 은 구글 권한까지(캘린더도 끊김) */
export async function POST(request: Request) {
  const a = await cardsMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as { revokeAll?: unknown };
  try {
    await disconnectCards(a.id, body.revokeAll === true);
    return Response.json({ ok: true });
  } catch (e) {
    return cardsError(e);
  }
}
