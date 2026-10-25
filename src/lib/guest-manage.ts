import { createHash, createHmac } from "crypto";
import { getAdminClient } from "@/lib/supabase";

/**
 * 게스트 예약 관리 링크 (개선-40).
 * - 토큰: 서버 비밀값으로 예약 id 를 HMAC 한 32바이트(base64url 43자) — 추측할 수 없고, 같은 예약이면 언제 메일을 보내도 같은 링크.
 * - DB 에는 sha256(토큰)만 둔다(조회용). 원문은 게스트 메일 링크에만.
 * - 링크는 orbit42.org/b#<토큰> — '#' 뒤는 서버로 가지 않아 요청 로그·Referer 에 토큰이 남지 않는다.
 *   페이지가 토큰을 POST 본문으로 보내 조회한다.
 * - 만료: 예약 끝 + 7일(계산, 칸 없음). 만료·취소된 예약은 조회만.
 */
export const MANAGE_GRACE_MS = 7 * 24 * 60 * 60_000;

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("missing secret for guest manage token");
  return s;
}

export function manageTokenFor(bookingId: string): string {
  return createHmac("sha256", secret()).update(`guest-manage:v1:${bookingId}`).digest("base64url");
}

export function manageTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** 게스트 메일에 넣을 관리 링크(상대 경로) — 처음이면 해시를 저장한다 */
export async function ensureManagePath(bookingId: string): Promise<string> {
  const token = manageTokenFor(bookingId);
  await getAdminClient()
    .from("bookings")
    .update({ guest_manage_token_hash: manageTokenHash(token) })
    .eq("id", bookingId)
    .is("guest_manage_token_hash", null);
  return `/b#${token}`;
}

/** 관리 링크 만료 — 예약 끝 + 7일 */
export function manageExpired(scheduledEndAt: string | null | undefined, scheduledAt: string): boolean {
  const end = new Date(scheduledEndAt ?? scheduledAt).getTime();
  return Date.now() > end + MANAGE_GRACE_MS;
}

/** 캘린더에 추가(.ics) */
export function bookingIcs(args: {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  hostLabel: string;
}): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Orbit42//Booking//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${args.id}@orbit42.org`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(args.start)}`,
    `DTEND:${fmt(args.end)}`,
    `SUMMARY:${esc(args.title)}`,
    `DESCRIPTION:${esc(`${args.hostLabel}님과의 예약 (Orbit42)`)}`,
    ...(args.location ? [`LOCATION:${esc(args.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
