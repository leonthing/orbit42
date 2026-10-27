import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import {
  chatRoleFor,
  getChat,
  loadChatBooking,
  markChatRead,
  reportChatMessage,
  sendChatMessage,
  setChatClosed,
} from "@/lib/booking-chat";

export const dynamic = "force-dynamic";

/**
 * 예약 대화 (1.8.0) — 그 예약의 호스트·로그인 게스트만. 웹(쿠키)·앱(Bearer) 둘 다.
 * GET  → { messages, state, hostLabel, guestLabel, slotTitle, suggestFirstNote, role } (열면 읽음 처리)
 * POST { body } → 보내기
 * PATCH { action: "read" } | { action: "close" | "reopen" } (호스트) | { action: "report", messageId, reason? }
 * 계정 없는 게스트는 /api/guest-booking(관리 토큰)으로 쓴다.
 */
async function resolve(id: string) {
  const session = await getSession();
  if (!session) return { error: Response.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  const { data: me } = await getAdminClient().from("users").select("id").eq("username", session.username).maybeSingle();
  const b = await loadChatBooking(id);
  const role = b ? chatRoleFor(b, me?.id as string | undefined) : null;
  if (!b || !role || !me) return { error: Response.json({ error: "예약을 찾을 수 없어요." }, { status: 404 }) };
  return { b, role, userId: me.id as string };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const r = await resolve(params.id);
  if ("error" in r) return r.error;
  const chat = await getChat(r.b, r.role, { viewerUserId: r.userId });
  return Response.json({ ...chat, role: r.role }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const r = await resolve(params.id);
  if ("error" in r) return r.error;
  let body: { body?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const res = await sendChatMessage({ booking: r.b, role: r.role, senderId: r.userId, body: typeof body.body === "string" ? body.body : "" });
  if ("error" in res) return Response.json({ error: res.error }, { status: res.status ?? 400 });
  return Response.json({ ok: true, message: res.message });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const r = await resolve(params.id);
  if ("error" in r) return r.error;
  let body: { action?: unknown; messageId?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (body.action === "read") {
    await markChatRead(r.b.id, r.role, r.userId);
    return Response.json({ ok: true });
  }
  if (body.action === "close" || body.action === "reopen") {
    if (r.role !== "host") return Response.json({ error: "호스트만 대화를 닫을 수 있어요." }, { status: 403 });
    const res = await setChatClosed(r.b.id, body.action === "close", "host");
    if ("error" in res) return Response.json({ error: res.error }, { status: 500 });
    return Response.json({ ok: true, closed: body.action === "close" });
  }
  if (body.action === "report" && typeof body.messageId === "string") {
    const res = await reportChatMessage({
      booking: r.b,
      role: r.role,
      reporterId: r.userId,
      messageId: body.messageId,
      reason: typeof body.reason === "string" ? body.reason : null,
    });
    if ("error" in res) return Response.json({ error: res.error }, { status: 400 });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
}
