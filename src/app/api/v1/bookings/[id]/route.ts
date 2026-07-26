import { apiSession } from "@/lib/api-auth";
import { updateBookingStatus, cancelMyBooking } from "@/lib/slots";

export const dynamic = "force-dynamic";

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
