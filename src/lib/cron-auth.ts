import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Constant-time check that a request carries the cron bearer secret.
 *
 * Only the `Authorization: Bearer <CRON_SECRET>` header is accepted — the old
 * `?key=<secret>` query fallback was dropped because query strings leak into
 * CDN/proxy access logs, browser history, and Referer headers, which would
 * expose the master cron secret (that can force auctions / spam email).
 * Fails closed when CRON_SECRET is unset.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
