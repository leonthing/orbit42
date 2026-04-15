"use server";

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { sendPasswordResetEmail, sendVerifyEmail } from "@/lib/email";

const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;
const COOKIE_NAME = "orbit42_session";

function newToken() {
  return randomBytes(32).toString("hex");
}

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

/**
 * Internal helper used by signup. Creates a verification token and
 * triggers the email. Safe to await.
 */
export async function startEmailVerification(userId: string, email: string) {
  const db = getAdminClient();
  const token = newToken();
  await db.from("email_verification_tokens").insert({
    token,
    user_id: userId,
    email,
    expires_at: hoursFromNow(VERIFY_TTL_HOURS),
  });
  await sendVerifyEmail(email, token);
}

/** User-initiated resend (from the unverified banner). */
export async function resendVerificationEmail() {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요해요." };
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id, email, email_verified")
    .eq("username", session.username)
    .single();
  if (!user?.email) return { error: "이메일이 등록돼 있지 않아요." };
  if (user.email_verified) return { error: "이미 확인된 이메일이에요." };
  await startEmailVerification(user.id as string, user.email as string);
  return { success: true };
}

/** Called by /verify-email?token=... */
export async function verifyEmail(token: string) {
  const db = getAdminClient();
  const { data: row } = await db
    .from("email_verification_tokens")
    .select("user_id, email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!row) return { error: "유효하지 않은 링크예요." };
  if (row.used_at) return { error: "이미 사용된 링크예요." };
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { error: "만료된 링크예요. 다시 요청해주세요." };
  }
  await db
    .from("users")
    .update({ email_verified: true })
    .eq("id", row.user_id);
  await db
    .from("email_verification_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);
  return { success: true };
}

/**
 * Always returns { success: true } to avoid leaking whether an email
 * is registered. Sends a reset email only if a user matches.
 */
export async function requestPasswordReset(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { success: true };
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id, email")
    .ilike("email", normalized)
    .maybeSingle();
  if (user?.email) {
    const token = newToken();
    await db.from("password_reset_tokens").insert({
      token,
      user_id: user.id,
      expires_at: hoursFromNow(RESET_TTL_HOURS),
    });
    await sendPasswordResetEmail(user.email as string, token);
  }
  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  if (!token) return { error: "토큰이 없어요." };
  if (!newPassword || newPassword.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 해요." };
  }
  const db = getAdminClient();
  const { data: row } = await db
    .from("password_reset_tokens")
    .select("user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!row) return { error: "유효하지 않은 링크예요." };
  if (row.used_at) return { error: "이미 사용된 링크예요." };
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { error: "만료된 링크예요." };
  }
  // Fetch username to call change_password rpc (which needs current password).
  // Instead, update directly via a dedicated RPC; fall back to crypt update.
  const { error } = await db.rpc("reset_password_for_user", {
    p_user_id: row.user_id,
    p_new_password: newPassword,
  });
  if (error) {
    console.error("reset_password_for_user", error);
    return { error: "비밀번호 변경에 실패했어요." };
  }
  await db
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);
  return { success: true };
}

export async function deleteMyAccount() {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요해요." };
  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .delete()
    .eq("username", session.username);
  if (error) {
    console.error("delete account", error);
    return { error: "탈퇴 처리에 실패했어요." };
  }
  cookies().delete(COOKIE_NAME);
  return { success: true };
}
