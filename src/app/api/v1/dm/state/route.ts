import { dmButtonState, userIdOf } from "@/lib/dm";
import { dmMe, noStore } from "@/lib/dm-route";

export const dynamic = "force-dynamic";

/** GET ?username= → { state: 'open'|'request'|'pending'|'incoming'|null } — 프로필·오르빗의 '대화' 버튼 */
export async function GET(req: Request) {
  const a = await dmMe();
  if ("res" in a) return a.res;
  const username = new URL(req.url).searchParams.get("username") ?? "";
  const target = username ? await userIdOf(username) : null;
  const state = target ? await dmButtonState(a.me, target) : null;
  return Response.json({ state }, noStore);
}
