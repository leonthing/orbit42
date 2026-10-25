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
    return "예약을 잠시 멈춘 링크예요. 다시 받으면 예약할 수 있어요.";
  }
  const now = Date.now();
  if (slot.valid_until && Date.parse(slot.valid_until) < now) {
    return `예약 받기 마감일(${kstDay(slot.valid_until)})이 지났어요. 마감일을 비우거나 늦추면 다시 열려요.`;
  }
  if (slot.valid_from && Date.parse(slot.valid_from) > now) {
    return `예약 받기 시작일이 ${kstDay(slot.valid_from)}이라 아직 열리기 전이에요.`;
  }
  if (slot.mode === "manual") {
    return windowCount === 0
      ? "직접 고른 시간이 없어요. 시간을 추가하면 그 시간에 예약을 받아요."
      : "직접 고른 시간이 모두 지났거나 마감됐어요. 새 시간을 추가해 보세요.";
  }
  const hasHours =
    slot.working_hours &&
    Object.values(slot.working_hours).some((ranges) => (ranges ?? []).length > 0);
  if (!hasHours) {
    return "매주 열어둘 시간이 비어 있어요. 요일과 시간을 정하면 그 안에서 빈 시간이 자동으로 열려요.";
  }
  return "매주 열어둘 시간 안의 시간이 내 일정·앞뒤 여유 시간·최소 몇 시간 전 조건과 모두 겹쳐요. 캘린더 일정이나 이 조건들을 확인해 보세요.";
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
    return Response.json({ error: "예약 링크를 찾을 수 없어요." }, { status: 404 });
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
