import { apiSession, apiUserId } from "@/lib/api-auth";
import { changeBookingListState, type BookingListResult } from "@/lib/booking-list-state";
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

  return listStateResponse(await changeBookingListState(userId, params.id, "delete"));
}

function listStateResponse(result: BookingListResult) {
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}

const HOST_ACTIONS = {
  confirm: "confirmed",
  cancel: "canceled",
  complete: "completed",
} as const;

/**
 * 보관/되돌리기(개선-25) — 내 쪽 목록에서만. 상대방 목록은 그대로.
 * 보관은 삭제와 같은 규칙: 진행 중(대기/확정 + 미래) 예약은 안 된다.
 */
async function setArchived(request: Request, id: string, archived: boolean) {
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }
  return listStateResponse(
    await changeBookingListState(userId, id, archived ? "archive" : "unarchive"),
  );
}

// PATCH { action: "confirm" | "cancel" | "complete" | "cancelMine" | "archive" | "unarchive" }
// confirm/cancel/complete 는 호스트 액션(소유권은 updateBookingStatus가 검증),
// cancelMine 은 게스트 본인 취소, archive/unarchive 는 내 목록의 보관(개선-25).
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
  if (action === "archive" || action === "unarchive") {
    return setArchived(request, params.id, action === "archive");
  }
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
