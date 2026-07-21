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
  // Use only IPs the platform sets, never the client-supplied left-most
  // `x-forwarded-for` entry (which an attacker can spoof per-request to rotate
  // the bucket key and bypass throttling). On Vercel `x-vercel-forwarded-for`
  // / `x-real-ip` are set by the edge and cannot be forged by the client; as a
  // last resort take the RIGHT-most XFF hop (the one the platform appended).
  const xff = h.get("x-forwarded-for");
  const ip =
    h.get("x-vercel-forwarded-for")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    (xff ? xff.split(",").pop()?.trim() : "") ||
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
