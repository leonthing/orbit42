import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import {
  rescheduleMyBooking,
  proposeRescheduleAsHost,
  respondToReschedule,
  withdrawReschedule,
} from "@/lib/slots";

export const dynamic = "force-dynamic";

/**
 * POST — 시간 변경 요청.
 *
 * 게스트: { startAt } 또는 { availabilityId } — 호스트가 열어둔 가용 시간
 * 안에서 고른 것이므로 바로 옮긴다 (승인이 필요한 슬롯이면 pending 으로).
 * 호스트: { startAt, note? } — 게스트가 그 시간에 올 수 있는지 알 수 없으니
 * 제안만 남기고 게스트의 수락을 기다린다.
 *
 * 어느 쪽인지는 서버가 예약의 host_id/guest_id 로 판단한다.
 */
export async function POST(
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

  let body: { startAt?: string; availabilityId?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.startAt && !body.availabilityId) {
    return Response.json({ error: "시간을 선택해주세요." }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("id, host_id, guest_id")
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

  try {
    if (isHost) {
      if (!body.startAt) {
        return Response.json({ error: "시간을 선택해주세요." }, { status: 400 });
      }
      const result = await proposeRescheduleAsHost(
        params.id,
        body.startAt,
        body.note ?? null,
      );
      if ("error" in result) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      // applied=true 는 비회원 게스트라 수락 없이 바로 옮긴 경우다.
      return Response.json({ ok: true, applied: result.applied });
    }

    const result = await rescheduleMyBooking(params.id, {
      startAt: body.startAt,
      availabilityId: body.availabilityId,
    });
    if ("error" in result && result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({
      ok: true,
      applied: true,
      status: "status" in result ? result.status : undefined,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "요청을 처리하지 못했어요.";
    return Response.json({ error: message }, { status: 400 });
  }
}

// PATCH { action: "accept" | "decline" | "withdraw" }
// accept/decline 은 제안을 받은 쪽, withdraw 는 제안한 쪽이 쓴다.
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
  const action = body.action;
  if (action !== "accept" && action !== "decline" && action !== "withdraw") {
    return Response.json({ error: "알 수 없는 액션이에요." }, { status: 400 });
  }

  try {
    const result =
      action === "withdraw"
        ? await withdrawReschedule(params.id)
        : await respondToReschedule(params.id, action);
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "요청을 처리하지 못했어요.";
    return Response.json({ error: message }, { status: 400 });
  }
}
