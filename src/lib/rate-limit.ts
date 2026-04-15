import { headers } from "next/headers";

/**
 * Tiny in-memory token bucket keyed by (bucket, subject). Good enough
 * to slow down spam / enumeration on a single Vercel instance; switch
 * to Upstash/Redis if horizontal scale matters.
 */
type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function clientKey(prefix: string, subject?: string): string {
  const h = headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}:${subject ?? ""}`;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

// Opportunistic cleanup so the map doesn't grow without bound.
setInterval(() => {
  const now = Date.now();
  store.forEach((v, k) => {
    if (v.resetAt < now) store.delete(k);
  });
}, 60_000).unref?.();
