"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase";

const COOKIE_NAME = "orbit42_session";

export async function login(username: string, password: string) {
  const db = getAdminClient();
  const { data, error } = await db
    .rpc("verify_user", { p_username: username, p_password: password });

  if (error || !data) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  cookies().set(COOKIE_NAME, JSON.stringify({ username }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return { success: true, username };
}

export async function signup(username: string, password: string, displayName?: string) {
  if (!username || !password) {
    return { error: "아이디와 비밀번호를 입력해주세요." };
  }
  if (username.length < 2 || !/^[a-z0-9_-]+$/.test(username)) {
    return { error: "아이디는 2자 이상, 영문 소문자/숫자/하이픈만 가능합니다." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const db = getAdminClient();

  // Check if username exists
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  if (existing) {
    return { error: "이미 사용 중인 아이디입니다." };
  }

  // Create user with hashed password
  const { error } = await db.rpc("create_user", {
    p_username: username,
    p_password: password,
    p_display_name: displayName || username,
  });

  if (error) {
    return { error: "회원가입에 실패했습니다." };
  }

  // Auto login
  cookies().set(COOKIE_NAME, JSON.stringify({ username }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { success: true, username };
}

export async function logout() {
  cookies().delete(COOKIE_NAME);
  return { success: true };
}

export async function getSession() {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { username: string };
  } catch {
    return null;
  }
}

export async function isAuthenticated() {
  return (await getSession()) !== null;
}

export async function getProfile(username: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("username, display_name, created_at")
    .eq("username", username)
    .single();
  return data;
}

export async function updateProfile(username: string, displayName: string) {
  const session = await getSession();
  if (!session || session.username !== username) {
    return { error: "권한이 없습니다." };
  }

  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("username", username);

  if (error) return { error: "프로필 업데이트에 실패했습니다." };
  return { success: true };
}

export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string
) {
  const session = await getSession();
  if (!session || session.username !== username) {
    return { error: "권한이 없습니다." };
  }
  if (newPassword.length < 6) {
    return { error: "새 비밀번호는 6자 이상이어야 합니다." };
  }

  const db = getAdminClient();

  // Verify current password
  const { data: valid } = await db.rpc("verify_user", {
    p_username: username,
    p_password: currentPassword,
  });

  if (!valid) {
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }

  // Update password
  const { error } = await db.rpc("change_password", {
    p_username: username,
    p_new_password: newPassword,
  });

  if (error) return { error: "비밀번호 변경에 실패했습니다." };
  return { success: true };
}
