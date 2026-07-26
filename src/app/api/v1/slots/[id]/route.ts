import { apiSession } from "@/lib/api-auth";
import { toApiSlotDetail } from "@/lib/api-slots";
import {
  listMySlots,
  updateSlot,
  type SlotInput,
  type SlotType,
  type SlotMode,
} from "@/lib/slots";
import type { WorkingHours } from "@/lib/slot-availability";

export const dynamic = "force-dynamic";

async function findMySlot(id: string) {
  return (await listMySlots()).find((s) => s.id === id) ?? null;
}

// GET — 슬롯 상세 (편집 화면용)
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const slot = await findMySlot(params.id);
  if (!slot) {
    return Response.json({ error: "슬롯을 찾을 수 없어요." }, { status: 404 });
  }
  return Response.json({ slot: toApiSlotDetail(slot, session.username) });
}

const SLOT_TYPES: SlotType[] = ["1on1", "companion", "group"];
const MODES: SlotMode[] = ["manual", "auto"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** workingHours 입력을 검증·정제한다. 형식이 어긋나면 null. */
function sanitizeWorkingHours(raw: unknown): WorkingHours | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: WorkingHours = {};
  for (const [day, ranges] of Object.entries(raw as Record<string, unknown>)) {
    if (!DAYS.includes(day)) return null;
    if (!Array.isArray(ranges) || ranges.length > 4) return null;
    const clean: { start: string; end: string }[] = [];
    for (const r of ranges) {
      const start = (r as { start?: unknown })?.start;
      const end = (r as { end?: unknown })?.end;
      if (
        typeof start !== "string" ||
        typeof end !== "string" ||
        !HHMM.test(start) ||
        !HHMM.test(end) ||
        start >= end
      ) {
        return null;
      }
      clean.push({ start, end });
    }
    if (clean.length > 0) out[day as keyof WorkingHours] = clean;
  }
  return out;
}

function parseIsoOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return v;
  return undefined; // 무시
}

// PATCH — 부분 수정. 활성 토글부터 상세 편집 필드까지 (camelCase → SlotInput).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const patch: Partial<SlotInput> = {};

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return Response.json({ error: "active 값이 올바르지 않아요." }, { status: 400 });
    }
    patch.active = body.active;
  }
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title || title.length > 100) {
      return Response.json({ error: "제목은 1~100자여야 해요." }, { status: 400 });
    }
    patch.title = title;
  }
  if (body.description !== undefined) {
    patch.description =
      body.description === null ? null : String(body.description).slice(0, 2000);
  }
  if (body.durationMin !== undefined) {
    const v = Number(body.durationMin);
    if (!Number.isInteger(v) || v < 5 || v > 480) {
      return Response.json({ error: "소요시간은 5~480분이어야 해요." }, { status: 400 });
    }
    patch.duration_min = v;
  }
  if (body.priceCents !== undefined) {
    const v = Number(body.priceCents);
    if (!Number.isInteger(v) || v < 0 || v > 100_000_000_00) {
      return Response.json({ error: "가격이 올바르지 않아요." }, { status: 400 });
    }
    patch.price_cents = v;
  }
  if (body.capacity !== undefined) {
    const v = Number(body.capacity);
    if (!Number.isInteger(v) || v < 1 || v > 100) {
      return Response.json({ error: "정원은 1~100이어야 해요." }, { status: 400 });
    }
    patch.capacity = v;
  }
  if (body.slotType !== undefined) {
    if (!SLOT_TYPES.includes(body.slotType as SlotType)) {
      return Response.json({ error: "슬롯 유형이 올바르지 않아요." }, { status: 400 });
    }
    patch.slot_type = body.slotType as SlotType;
  }
  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode as SlotMode)) {
      return Response.json({ error: "예약 방식이 올바르지 않아요." }, { status: 400 });
    }
    patch.mode = body.mode as SlotMode;
  }
  if (body.autoApprove !== undefined) {
    patch.auto_approve = Boolean(body.autoApprove);
  }
  if (body.locations !== undefined) {
    if (
      !Array.isArray(body.locations) ||
      body.locations.length > 10 ||
      body.locations.some((l) => typeof l !== "string" || l.length > 100)
    ) {
      return Response.json({ error: "위치 목록이 올바르지 않아요." }, { status: 400 });
    }
    patch.locations = body.locations as string[];
  }
  if (body.workingHours !== undefined) {
    const wh = sanitizeWorkingHours(body.workingHours);
    if (wh === null) {
      return Response.json({ error: "근무시간 형식이 올바르지 않아요." }, { status: 400 });
    }
    patch.working_hours = wh;
  }
  for (const [key, field, min, max] of [
    ["slotIntervalMin", "slot_interval_min", 5, 240],
    ["minNoticeHours", "min_notice_hours", 0, 720],
    ["maxAdvanceDays", "max_advance_days", 1, 365],
    ["bufferMin", "buffer_min", 0, 240],
  ] as const) {
    if (body[key] !== undefined) {
      const v = Number(body[key]);
      if (!Number.isInteger(v) || v < min || v > max) {
        return Response.json({ error: `${key} 값이 올바르지 않아요.` }, { status: 400 });
      }
      (patch as Record<string, unknown>)[field] = v;
    }
  }
  const validFrom = parseIsoOrNull(body.validFrom);
  if (validFrom !== undefined) patch.valid_from = validFrom;
  const validUntil = parseIsoOrNull(body.validUntil);
  if (validUntil !== undefined) patch.valid_until = validUntil;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "변경할 내용이 없어요." }, { status: 400 });
  }

  const result = await updateSlot(params.id, patch);
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const updated = await findMySlot(params.id);
  if (!updated) {
    return Response.json({ error: "슬롯을 찾을 수 없어요." }, { status: 404 });
  }
  return Response.json({ slot: toApiSlotDetail(updated, session.username) });
}
