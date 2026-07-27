import { apiSession } from "@/lib/api-auth";
import {
  listMySlots,
  getBookableOptions,
  getUpcomingAvailabilities,
  addAvailability,
} from "@/lib/slots";

export const dynamic = "force-dynamic";

/** "7월 16일" — KST 기준 표시. */
function kstDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  });
}

/** 예약 가능 시간이 0개일 때 호스트에게 보여줄 원인 진단 (우선순위 순). */
function diagnoseEmpty(
  slot: Awaited<ReturnType<typeof listMySlots>>[number],
  windowCount: number,
): string {
  if (!slot.active) {
    return "슬롯이 꺼져 있어요. 활성화하면 다시 예약을 받을 수 있어요.";
  }
  const now = Date.now();
  if (slot.valid_until && Date.parse(slot.valid_until) < now) {
    return `판매 기간이 ${kstDay(slot.valid_until)}에 끝났어요. 판매 기간을 비우거나 연장하면 다시 열려요.`;
  }
  if (slot.valid_from && Date.parse(slot.valid_from) > now) {
    return `판매 시작일이 ${kstDay(slot.valid_from)}이라 아직 열리기 전이에요.`;
  }
  if (slot.mode === "manual") {
    return windowCount === 0
      ? "등록된 시간 창이 없어요. 시간 창을 추가하면 그 시간에 예약을 받아요."
      : "등록된 시간 창이 모두 지났거나 마감됐어요. 새 시간 창을 추가해 보세요.";
  }
  const hasHours =
    slot.working_hours &&
    Object.values(slot.working_hours).some((ranges) => (ranges ?? []).length > 0);
  if (!hasHours) {
    return "요일별 근무시간이 비어 있어요. 근무시간을 설정하면 그 안에서 빈 시간이 자동으로 열려요.";
  }
  return "근무시간 안의 시간이 기존 일정·이동시간 버퍼·최소 통보 시간과 모두 겹쳐요. 캘린더 일정이나 버퍼·통보 조건을 확인해 보세요.";
}

// GET — 예약 가능 시간 미리보기(options) + 수동 시간 창 목록(windows)
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const slot = (await listMySlots()).find((s) => s.id === params.id);
  if (!slot) {
    return Response.json({ error: "슬롯을 찾을 수 없어요." }, { status: 404 });
  }

  const [options, windows] = await Promise.all([
    getBookableOptions(slot),
    slot.mode === "manual"
      ? getUpcomingAvailabilities(slot.id)
      : Promise.resolve([]),
  ]);

  return Response.json({
    options: options.slice(0, 50).map((o) => ({
      startAt: o.start_at,
      endAt: o.end_at,
      remaining: o.remaining,
      availabilityId: o.availability_id,
    })),
    windows: windows.map((w) => ({
      id: w.id,
      startAt: w.start_at,
      capacity: w.capacity,
      bookedCount: w.booked_count,
    })),
    // 왜 비었는지 — 호스트가 원인을 바로 알 수 있도록 (옵션이 있으면 null)
    emptyReason: options.length === 0 ? diagnoseEmpty(slot, windows.length) : null,
  });
}

// POST { startAt, capacity? } — 수동 시간 창 추가
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { startAt?: string; capacity?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const startAt = body.startAt ?? "";
  if (Number.isNaN(Date.parse(startAt))) {
    return Response.json({ error: "시작 시각이 올바르지 않아요." }, { status: 400 });
  }
  if (Date.parse(startAt) < Date.now()) {
    return Response.json({ error: "지나간 시각에는 추가할 수 없어요." }, { status: 400 });
  }
  let capacity: number | undefined;
  if (body.capacity !== undefined) {
    const v = Number(body.capacity);
    if (!Number.isInteger(v) || v < 1 || v > 100) {
      return Response.json({ error: "정원이 올바르지 않아요." }, { status: 400 });
    }
    capacity = v;
  }

  const result = await addAvailability(params.id, startAt, capacity);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
