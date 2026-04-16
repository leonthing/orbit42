"use server";

import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";

const CODES_PER_USER = 3;

export type InviteCode = {
  id: string;
  code: string;
  used_by_username: string | null;
  used_at: string | null;
  created_at: string;
};

export async function getMyInviteCodes(): Promise<InviteCode[]> {
  const session = await getSession();
  if (!session) return [];
  const db = getAdminClient();
  const { data: me } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  if (!me) return [];

  const { data } = await db
    .from("invite_codes")
    .select("id, code, used_by, used_at, created_at")
    .eq("creator_id", me.id)
    .order("created_at", { ascending: true });

  if (!data) return [];

  const usedByIds = data
    .filter((c) => c.used_by)
    .map((c) => c.used_by as string);
  const userMap = new Map<string, string>();
  if (usedByIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, username")
      .in("id", usedByIds);
    for (const u of users ?? []) {
      userMap.set(u.id as string, u.username as string);
    }
  }

  return data.map((c) => ({
    id: c.id as string,
    code: c.code as string,
    used_by_username: c.used_by ? (userMap.get(c.used_by as string) ?? null) : null,
    used_at: (c.used_at as string | null) ?? null,
    created_at: c.created_at as string,
  }));
}

/** Validate an invite code. Returns creator user id if valid. */
export async function validateInviteCode(
  code: string,
): Promise<{ valid: true; id: string } | { valid: false; error: string }> {
  if (!code.trim()) return { valid: false, error: "초대 코드를 입력해주세요." };
  const db = getAdminClient();
  const { data } = await db
    .from("invite_codes")
    .select("id, used_by")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!data) return { valid: false, error: "유효하지 않은 초대 코드입니다." };
  if (data.used_by) return { valid: false, error: "이미 사용된 초대 코드입니다." };
  return { valid: true, id: data.id as string };
}

/** Look up the inviter's public profile for an invite code (for landing UI). */
export async function getInviterByCode(code: string): Promise<{
  code: string;
  status: "ok" | "used" | "invalid";
  inviter: { username: string; display_name: string | null; avatar_url: string | null } | null;
}> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { code: normalized, status: "invalid", inviter: null };
  const db = getAdminClient();
  const { data } = await db
    .from("invite_codes")
    .select("code, creator_id, used_by")
    .eq("code", normalized)
    .maybeSingle();
  if (!data) return { code: normalized, status: "invalid", inviter: null };
  const { data: inviter } = await db
    .from("users")
    .select("username, display_name, avatar_url")
    .eq("id", data.creator_id)
    .single();
  return {
    code: normalized,
    status: data.used_by ? "used" : "ok",
    inviter: inviter
      ? {
          username: inviter.username as string,
          display_name: (inviter.display_name as string | null) ?? null,
          avatar_url: (inviter.avatar_url as string | null) ?? null,
        }
      : null,
  };
}

/** Mark invite code as used + generate CODES_PER_USER new codes for the new user. */
export async function claimInviteCode(codeId: string, newUserId: string) {
  const db = getAdminClient();
  await db
    .from("invite_codes")
    .update({ used_by: newUserId, used_at: new Date().toISOString() })
    .eq("id", codeId)
    .is("used_by", null);
  await db.rpc("generate_invite_codes", {
    p_user_id: newUserId,
    p_count: CODES_PER_USER,
  });
}

/** Seed initial codes for the admin/founder (run once). */
export async function seedFounderCodes(username: string, count: number = 10) {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (!data) return;
  const { data: existing } = await db
    .from("invite_codes")
    .select("id")
    .eq("creator_id", data.id)
    .limit(1);
  if (existing && existing.length > 0) return;
  await db.rpc("generate_invite_codes", {
    p_user_id: data.id,
    p_count: count,
  });
}
