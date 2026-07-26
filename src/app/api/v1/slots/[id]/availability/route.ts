import { apiSession } from "@/lib/api-auth";
import {
  listMySlots,
  getBookableOptions,
  getUpcomingAvailabilities,
  addAvailability,
} from "@/lib/slots";

export const dynamic = "force-dynamic";

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
