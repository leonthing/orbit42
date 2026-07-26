import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { updateBookingStatus, cancelMyBooking } from "@/lib/slots";

export const dynamic = "force-dynamic";

// DELETE — 내 목록에서 예약 숨김(소프트 삭제). 상대방 기록·거래 통계는 유지.
// 진행 중(대기/확정 + 미래) 예약은 먼저 취소해야 삭제 가능.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const db = getAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("id, host_id, guest_id, status, scheduled_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!booking) {
    return Response.json({ error: "예약을 찾을 수 없어요." }, { status: 404 });
  }

  const isHost = booking.host_id === userId;
  const isGuest = booking.guest_id === userId;
  if (!isHost && !isGuest) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const active =
    ["pending", "confirmed"].includes(booking.status as string) &&
    new Date(booking.scheduled_at as string).getTime() > Date.now();
  if (active) {
    return Response.json(
      { error: "진행 중인 예약은 먼저 취소한 뒤에 삭제할 수 있어요." },
      { status: 400 },
    );
  }

  const { error } = await db
    .from("bookings")
    .update(
      isHost ? { hidden_by_host: true } : { hidden_by_guest: true },
    )
    .eq("id", params.id);
  if (error) {
    console.error("booking hide", error);
    return Response.json({ error: "삭제에 실패했어요." }, { status: 400 });
  }
  return Response.json({ ok: true });
}

const HOST_ACTIONS = {
  confirm: "confirmed",
  cancel: "canceled",
  complete: "completed",
} as const;

// PATCH { action: "confirm" | "cancel" | "complete" | "cancelMine" }
// confirm/cancel/complete 는 호스트 액션(소유권은 updateBookingStatus가 검증),
// cancelMine 은 게스트 본인 취소.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const action = body.action ?? "";
  try {
    if (action === "cancelMine") {
      const result = await cancelMyBooking(params.id);
      if (result && "error" in result && result.error) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ ok: true });
    }
    if (action in HOST_ACTIONS) {
      const result = await updateBookingStatus(
        params.id,
        HOST_ACTIONS[action as keyof typeof HOST_ACTIONS],
      );
      if (result && "error" in result && result.error) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ ok: true });
    }
    return Response.json({ error: "알 수 없는 액션이에요." }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "요청을 처리하지 못했어요.";
    return Response.json({ error: message }, { status: 400 });
  }
}
