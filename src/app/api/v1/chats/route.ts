import { unreadChatCounts } from "@/lib/booking-chat";
import { unreadDmCount } from "@/lib/dm";
import { dmMe, noStore } from "@/lib/dm-route";
import { v190Open } from "@/lib/dm-flags";

export const dynamic = "force-dynamic";

/** GET → { booking, dm, total, dmOpen } — 대화 탭 배지 하나에 예약 대화와 1:1 대화를 합친다(1.9.0). 1:1 요청도 1로 센다. */
export async function GET() {
  const a = await dmMe();
  if ("res" in a) return a.res;
  const unread = await unreadChatCounts(a.me);
  const booking = Object.values(unread).reduce((s, n) => s + n, 0);
  const dm = await unreadDmCount(a.me);
  return Response.json({ booking, dm, total: booking + dm, dmOpen: v190Open() }, noStore);
}
