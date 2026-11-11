import { createHash } from "crypto";
import { cache } from "react";
import { getAdminClient } from "@/lib/supabase";
import type { SessionData } from "@/lib/session";

/**
 * 세션 버전(보안-8) — 비밀번호를 바꾸면 그 전에 만든 로그인(웹 쿠키·앱 토큰)이 끊기게 한다.
 * 세션에 password_hash 의 지문(pv)을 넣고, 확인할 때 지금 지문과 비교한다. 칸 추가 없음.
 * pv 가 없는 옛 세션(11-11 키 교체 뒤 발급)은 LEGACY_UNTIL 까지만 받는다 — 웹 쿠키는 7일이면 어차피 끝난다.
 */
const LEGACY_UNTIL = Date.parse("2026-11-19T00:00:00+09:00");

const currentVersion = cache(async (username: string): Promise<string | null> => {
  const { data } = await getAdminClient()
    .from("users")
    .select("password_hash")
    .eq("username", username)
    .maybeSingle();
  if (!data) return null;
  return createHash("sha256").update(`pv1:${(data.password_hash as string | null) ?? ""}`).digest("hex").slice(0, 16);
});

/** 새 세션에 넣을 지문 */
export async function passwordVersion(username: string): Promise<string | undefined> {
  return (await currentVersion(username)) ?? undefined;
}

/** 일반 로그인 세션이 아직 유효한지 (목적 토큰·PAT 는 부르는 쪽에서 따로 본다) */
export async function isSessionCurrent(session: SessionData): Promise<boolean> {
  if (!session.pv) return Date.now() < LEGACY_UNTIL;
  const v = await currentVersion(session.username);
  return !!v && v === session.pv;
}
