/**
 * 모바일 앱 OAuth 콜백 공용: "mobile:" state에 실린 단일 목적 토큰을 검증해
 * 사용자 id를 해석한다. (앱에는 웹 세션 쿠키가 없으므로 쿠키 대신 이 토큰이
 * 콜백의 신원 바인딩 역할을 한다 — lib/api-auth.issuePurposeToken 발급)
 */

import { verifySession } from "@/lib/session";
import { getAdminClient } from "@/lib/supabase";

export async function resolveMobileOAuthUser(
  token: string,
  purpose: string,
): Promise<{ userId: string; username: string } | null> {
  const session = await verifySession(token);
  if (!session || session.purpose !== purpose) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  if (!data?.id) return null;
  return { userId: data.id as string, username: session.username };
}
