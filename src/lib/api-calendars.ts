/** /api/v1/calendars 공용 — 직렬화와 입력 검증 상수. */

import type { Calendar } from "@/lib/calendars-types";

export const CALENDAR_PURPOSES = [
  "personal", "work", "couple", "income", "invest", "hobby",
  "other", "health", "social", "learning",
] as const;
export const CALENDAR_VISIBILITIES = ["private", "followers", "public"] as const;
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function toApiCalendar(c: Calendar & { hourly_rate_krw?: number | null }) {
  return {
    id: c.id,
    name: c.name,
    purpose: c.purpose ?? "personal",
    color: c.color,
    visibility: c.visibility,
    source: c.source,
    isDefault: c.is_default,
    // A2: 이 캘린더의 시간당 단가(원) — 수입 버킷 금액 계산에 우선 적용
    hourlyRateKrw: c.hourly_rate_krw ?? null,
    // 목표 캘린더 — 진행률(progress)은 /api/v1/calendars/goals 에서 계산해 붙인다
    goalTitle: c.goal_title ?? null,
    goalTargetHours: c.goal_target_hours ?? null,
    goalDeadline: c.goal_deadline ?? null,
    goalStartedAt: c.goal_started_at ?? null,
    archivedAt: c.archived_at ?? null,
  };
}
