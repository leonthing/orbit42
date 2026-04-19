"use server";

import { getAdminClient } from "@/lib/supabase";

/** Normalize user-entered refs: "@leo ", "Leo" → "leo". Empty → null. */
function normalizeRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  return cleaned || null;
}

export type ReferrerPreview = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** Landing-page lookup: does this ref resolve to a real user? */
export async function getReferrerByUsername(
  raw: string,
): Promise<ReferrerPreview | null> {
  const username = normalizeRef(raw);
  if (!username) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();
  if (!data) return null;
  return {
    username: data.username as string,
    display_name: (data.display_name as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
  };
}

/** Send the welcome email for a newly-created user. Best-effort. */
export async function seedNewUser(
  newUserId: string,
  inviter: {
    username: string;
    display_name: string | null;
  } | null,
) {
  const db = getAdminClient();
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
 * Resolve a ref (username or @username) into a real user and, if found,
 * persist `invited_by_user_id`, create mutual follows, and notify the
 * inviter. Returns the inviter's public fields (so the welcome email can
 * address them by name), or null when the ref didn't resolve.
 */
export async function applyReferralIfPresent(
  newUserId: string,
  rawRef: string | null | undefined,
): Promise<{ username: string; display_name: string | null } | null> {
  const username = normalizeRef(rawRef);
  if (!username) return null;

  const db = getAdminClient();
  const { data: inviter } = await db
    .from("users")
    .select("id, username, display_name, email, email_verified")
    .eq("username", username)
    .maybeSingle();
  if (!inviter) return null;
  const inviterId = inviter.id as string;
  if (inviterId === newUserId) return null;

  await db
    .from("users")
    .update({ invited_by_user_id: inviterId })
    .eq("id", newUserId);

  // Mutual follow — the new user's first orbit is their inviter.
  // Ignore duplicates if either direction already exists.
  await db
    .from("follows")
    .insert([
      { follower_id: inviterId, following_id: newUserId },
      { follower_id: newUserId, following_id: inviterId },
    ])
    .then(() => undefined, () => undefined);

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
    if (inviter.email && inviter.email_verified) {
      const { sendInviteUsedEmail } = await import("@/lib/email");
      await sendInviteUsedEmail(inviter.email as string, {
        inviteeLabel,
        inviteeUsername,
      });
    }
  } catch (err) {
    console.error("referral notify inviter", err);
  }

  return {
    username: inviter.username as string,
    display_name: (inviter.display_name as string | null) ?? null,
  };
}
