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

/** Seed CODES_PER_USER invite codes + welcome email for a new user. */
export async function seedNewUser(
  newUserId: string,
  inviter: {
    username: string;
    display_name: string | null;
  } | null,
) {
  const db = getAdminClient();
  await db.rpc("generate_invite_codes", {
    p_user_id: newUserId,
    p_count: CODES_PER_USER,
  });
  try {
    const { sendWelcomeEmail } = await import("@/lib/email");
    const { data: newUser } = await db
      .from("users")
      .select("email, username, display_name")
      .eq("id", newUserId)
      .single();
    if (newUser?.email) {
      await sendWelcomeEmail(newUser.email as string, {
        username: newUser.username as string,
        displayName: (newUser.display_name as string | null) ?? null,
        inviterLabel: inviter ? inviter.display_name || inviter.username : null,
        inviterUsername: inviter?.username ?? null,
      });
    }
  } catch (err) {
    console.error("seedNewUser welcome email", err);
  }
}

/**
 * Open-signup referral: if the code is valid + unused, claim it,
 * persist `invited_by_user_id`, create mutual follows, and notify
 * the inviter. Returns the inviter's public fields (for a follow-up
 * welcome email) or null when no referral applied.
 */
export async function applyReferralIfPresent(
  newUserId: string,
  rawCode: string | null | undefined,
): Promise<{ username: string; display_name: string | null } | null> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("invite_codes")
    .select("id, creator_id, used_by")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  if (data.used_by) return null;
  const inviterId = data.creator_id as string;
  if (inviterId === newUserId) return null;

  await db
    .from("invite_codes")
    .update({ used_by: newUserId, used_at: new Date().toISOString() })
    .eq("id", data.id as string)
    .is("used_by", null);
  await db
    .from("users")
    .update({ invited_by_user_id: inviterId })
    .eq("id", newUserId);

  // Mutual follow — the new user's first orbit is their inviter.
  await db
    .from("follows")
    .insert([
      { follower_id: inviterId, following_id: newUserId },
      { follower_id: newUserId, following_id: inviterId },
    ])
    .then(() => undefined, () => undefined);

  const { data: inviter } = await db
    .from("users")
    .select("username, display_name, email, email_verified")
    .eq("id", inviterId)
    .single();

  // Best-effort notify inviter (in-app + email).
  try {
    const { data: newUser } = await db
      .from("users")
      .select("username, display_name")
      .eq("id", newUserId)
      .single();
    const inviteeLabel =
      (newUser?.display_name as string | null) ||
      (newUser?.username as string) ||
      "새 멤버";
    const inviteeUsername = (newUser?.username as string) || "";
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: inviterId,
      type: "invite_used",
      title: `${inviteeLabel}님이 당신의 추천으로 가입했어요`,
      body: null,
      link: inviteeUsername ? `/${inviteeUsername}` : null,
      actorId: newUserId,
    });
    if (inviter?.email && inviter.email_verified) {
      const { sendInviteUsedEmail } = await import("@/lib/email");
      await sendInviteUsedEmail(inviter.email as string, {
        inviteeLabel,
        inviteeUsername,
      });
    }
  } catch (err) {
    console.error("referral notify inviter", err);
  }

  return inviter
    ? {
        username: inviter.username as string,
        display_name: (inviter.display_name as string | null) ?? null,
      }
    : null;
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
