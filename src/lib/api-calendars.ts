/** /api/v1/calendars 공용 — 직렬화와 입력 검증 상수. */

import type { Calendar } from "@/lib/calendars-types";

export const CALENDAR_PURPOSES = [
  "personal", "work", "couple", "income", "hobby",
  "other", "health", "social", "learning",
] as const;
export const CALENDAR_VISIBILITIES = ["private", "followers", "public"] as const;
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function toApiCalendar(c: Calendar) {
  return {
    id: c.id,
    name: c.name,
    purpose: c.purpose ?? "personal",
    color: c.color,
    visibility: c.visibility,
    source: c.source,
    isDefault: c.is_default,
  };
}
