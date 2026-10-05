import type { WorkingHours } from "@/lib/slot-availability";
/** /api/v1/slots 응답 직렬화 — TimeSlot(snake_case) → 모바일 계약(camelCase). */

import type { TimeSlot } from "@/lib/slots";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org";

export function toApiSlot(s: TimeSlot, username: string) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    description: s.description,
    durationMin: s.duration_min,
    priceCents: s.price_cents,
    currency: s.currency,
    capacity: s.capacity,
    slotType: s.slot_type,
    mode: s.mode,
    pricingModel: s.pricing_model,
    active: s.active,
    autoApprove: s.auto_approve,
    // 결제 방식 — 현재는 "offline"(만나서 결제)만. 결제 모듈은 이후 도입.
    paymentMethod: s.payment_method ?? "offline",
    shareUrl: `${SITE_URL.replace(/\/$/, "")}/${username}/s/${s.slug}`,
    createdAt: s.created_at,
  };
}

/** 상세/편집 화면용 — 목록 필드에 편집 가능한 설정 전부를 더한다. */
export function toApiSlotDetail(
  s: TimeSlot,
  username: string,
  menuIds?: string[],
) {
  return {
    ...toApiSlot(s, username),
    locations: s.locations ?? [],
    workingHours: s.working_hours ?? {},
    slotIntervalMin: s.slot_interval_min,
    minNoticeHours: s.min_notice_hours,
    maxAdvanceDays: s.max_advance_days,
    bufferMin: s.buffer_min,
    validFrom: s.valid_from,
    validUntil: s.valid_until,
    imageUrls: s.image_urls ?? [],
    menuIds: menuIds ?? [],
  };
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** workingHours 입력을 검증·정제한다. 형식이 어긋나면 null. */
export function sanitizeWorkingHours(raw: unknown): WorkingHours | null {
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
