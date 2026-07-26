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
    shareUrl: `${SITE_URL.replace(/\/$/, "")}/${username}/s/${s.slug}`,
    createdAt: s.created_at,
  };
}
