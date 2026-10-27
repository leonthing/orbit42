import { isAdmin } from "@/lib/admin";
import { adminDeleteChatThread, setChatClosed } from "@/lib/booking-chat";

export const dynamic = "force-dynamic";

/**
 * 관리자: 예약 대화 처리 (1.8.0)
 * POST { bookingId, action: "delete" } — 계정 없는 게스트의 삭제 요청(orbit42@nthing.net) 처리: 대화방 통째로 삭제. 신고 기록은 남는다.
 * POST { bookingId, action: "close" } — 신고 처리로 대화 닫기(closed_by=admin)
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "권한이 없어요." }, { status: 403 });
  let body: { bookingId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (typeof body.bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.bookingId)) {
    return Response.json({ error: "예약 id가 필요해요." }, { status: 400 });
  }
  if (body.action === "delete") {
    const res = await adminDeleteChatThread(body.bookingId);
    if ("error" in res) return Response.json({ error: res.error }, { status: 500 });
    return Response.json(res);
  }
  if (body.action === "close") {
    const res = await setChatClosed(body.bookingId, true, "admin");
    if ("error" in res) return Response.json({ error: res.error }, { status: 500 });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
}
