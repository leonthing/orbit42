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

/** 세지 않고 지금 한도를 넘었는지만 본다 — '실패만 세는' 제한에 쓴다 (예약 관리 링크의 잘못된 토큰) */
export function rateLimitExceeded(key: string, limit: number): { exceeded: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt < now) return { exceeded: false, retryAfter: 0 };
  return existing.count >= limit
    ? { exceeded: true, retryAfter: Math.ceil((existing.resetAt - now) / 1000) }
    : { exceeded: false, retryAfter: 0 };
}

// Opportunistic cleanup so the map doesn't grow without bound.
setInterval(() => {
  const now = Date.now();
  store.forEach((v, k) => {
    if (v.resetAt < now) store.delete(k);
  });
}, 60_000).unref?.();

/**
 * DB 로 세는 횟수 제한(보안-8) — Vercel 인스턴스가 여러 대여도 함께 센다.
 * key 는 sha256 해서 저장(아이디·IP·이메일 원문을 남기지 않음). 표가 없거나(마이그레이션 전)
 * DB 오류면 메모리 제한으로 대신한다. 오래된 기록은 /api/cron/cleanup 이 지운다.
 */
export async function rateLimitDb(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const [{ createHash }, { getAdminClient }] = await Promise.all([import("crypto"), import("@/lib/supabase")]);
  const sep = key.indexOf(":");
  const bucket = sep > 0 ? key.slice(0, sep) : "misc";
  const subject = createHash("sha256").update(key).digest("hex");
  const since = new Date(Date.now() - windowMs).toISOString();
  const db = getAdminClient();
  const { data, error } = await db
    .from("rate_limit_hits")
    .select("created_at")
    .eq("bucket", bucket)
    .eq("subject", subject)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return rateLimit(key, limit, windowMs);
  if ((data?.length ?? 0) >= limit) {
    const oldest = new Date(data![0].created_at as string).getTime();
    return { ok: false, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - Date.now()) / 1000)) };
  }
  const ins = await db.from("rate_limit_hits").insert({ bucket, subject });
  if (ins.error) return rateLimit(key, limit, windowMs);
  return { ok: true, retryAfter: 0 };
}
