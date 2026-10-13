/**
 * 개인 액세스 토큰 — 발급·확인·폐기. 발급·폐기는 웹 설정 > 연동 토큰에서 한다
 * (토큰 서명 키가 운영 서버에만 있어, 운영에서 발급해야 운영에서 통한다).
 * 토큰은 기존 세션 서명 형식에 purpose=personal_access 와 행 id(pat)를 싣고 만료는 없다.
 * 폐기하면 다음 요청부터 바로 막힌다 (요청마다 행을 확인).
 */
import { getAdminClient } from "@/lib/supabase";
import { signSession } from "@/lib/session";
import { PAT_PURPOSE } from "@/lib/pat-scope";

export async function issuePersonalAccessToken(userId: string, username: string, name: string) {
  const db = getAdminClient();
  const { data: row, error } = await db
    .from("personal_access_tokens")
    .insert({ user_id: userId, name })
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "발급 실패");
  const token = await signSession({ username, purpose: PAT_PURPOSE, pat: row.id as string });
  return { id: row.id as string, token };
}

/** 폐기되지 않았고 같은 사용자의 토큰인지. 사용 시각도 남긴다. */
export async function isPersonalAccessTokenActive(id: string, username: string): Promise<boolean> {
  const db = getAdminClient();
  const { data } = await db
    .from("personal_access_tokens")
    .select("id, revoked_at, user:users!personal_access_tokens_user_id_fkey(username)")
    .eq("id", id)
    .maybeSingle();
  const owner = (data?.user as unknown as { username: string } | null)?.username;
  if (!data || data.revoked_at || owner !== username) return false;
  await db.from("personal_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", id);
  return true;
}

export type PersonalAccessTokenRow = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export async function listPersonalAccessTokens(userId: string): Promise<PersonalAccessTokenRow[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("personal_access_tokens")
    .select("id, name, created_at, last_used_at, revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []) as PersonalAccessTokenRow[];
}

export async function revokePersonalAccessToken(userId: string, id: string) {
  const db = getAdminClient();
  const { error } = await db
    .from("personal_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
}
