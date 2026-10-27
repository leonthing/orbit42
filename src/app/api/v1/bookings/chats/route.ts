import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { unreadChatCounts } from "@/lib/booking-chat";

export const dynamic = "force-dynamic";

/** GET → { unread: { [bookingId]: 안 읽은 메시지 수 }, total } — 예약 탭·목록의 안 읽음 표시 (1.8.0) */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { data: me } = await getAdminClient().from("users").select("id").eq("username", session.username).maybeSingle();
  if (!me) return Response.json({ unread: {}, total: 0 });
  const unread = await unreadChatCounts(me.id as string);
  const total = Object.values(unread).reduce((a, n) => a + n, 0);
  return Response.json({ unread, total }, { headers: { "Cache-Control": "no-store" } });
}
