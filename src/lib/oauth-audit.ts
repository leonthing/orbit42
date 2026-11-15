// 일반 서버 모듈 — 서버 액션 아님. 소셜 로그인으로 '기존 계정'에 들어간 기록(PO 11/16, 보안 감사).
// 남기는 것: 시각·제공자·맞은 방법(email | apple_sub)·user_id·이메일 해시(HMAC-SHA256, 서버 키). 이메일 원문은 남기지 않는다. 90일 뒤 cleanup cron 이 지운다.
// 처리방침(접속 기록은 DB 에 따로 저장하지 않는다는 문구)을 고친 뒤 켜도록 OAUTH_AUDIT=1 일 때만 쓴다.
import { createHmac } from "node:crypto";
import { getAdminClient } from "@/lib/supabase";

export const OAUTH_AUDIT_DAYS = 90;

export function oauthAuditOn(): boolean {
  return process.env.OAUTH_AUDIT === "1";
}

/** 이메일 해시 — 같은 주소면 같은 값(대소문자·공백 무시), 키 없이는 되돌리거나 맞춰 볼 수 없다 */
export function emailHash(email: string): string {
  const key = process.env.AUDIT_HASH_KEY || process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) throw new Error("no audit key");
  return createHmac("sha256", `oauth-audit-v1:${key}`).update(email.trim().toLowerCase()).digest("hex");
}

/** 기록 실패가 로그인을 막지 않게 — 실패는 코드만 남긴다(이메일·토큰 없음) */
export async function auditOauthLogin(e: {
  provider: "google" | "apple";
  matchedBy: "email" | "apple_sub";
  userId: string;
  email: string | null;
}): Promise<void> {
  if (!oauthAuditOn()) return;
  try {
    const { error } = await getAdminClient().from("oauth_login_audit").insert({
      provider: e.provider,
      matched_by: e.matchedBy,
      user_id: e.userId,
      email_hash: e.email ? emailHash(e.email) : null,
    });
    if (error) console.error("oauth audit", error.code);
  } catch (err) {
    console.error("oauth audit", (err as Error)?.name ?? "error");
  }
}

/** 90일 지난 기록 지우기(cleanup cron). 표가 없으면(마이그레이션 전) 0 */
export async function cleanupOauthAudit(): Promise<number> {
  const { error, count } = await getAdminClient()
    .from("oauth_login_audit")
    .delete({ count: "exact" })
    .lt("created_at", new Date(Date.now() - OAUTH_AUDIT_DAYS * 24 * 3600_000).toISOString());
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return 0;
    throw new Error(error.code ?? "delete failed");
  }
  return count ?? 0;
}
