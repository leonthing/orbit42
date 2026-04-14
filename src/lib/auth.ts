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

  // Give the new user a default native calendar.
  const { data: freshUser } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (freshUser) {
    await db.from("calendars").insert({
      user_id: freshUser.id,
      name: "내 캘린더",
      purpose: "personal",
      color: "#6366f1",
      visibility: "private",
      source: "native",
      is_default: true,
    });
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
    .select(
      "username, display_name, birth_date, bio, avatar_url, social_links, education, interests, created_at",
    )
    .eq("username", username)
    .single();
  return data;
}

export async function uploadAvatar(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) return { error: "사진을 선택해주세요." };
  if (!file.type.startsWith("image/"))
    return { error: "이미지 파일만 가능합니다." };
  if (file.size > 3 * 1024 * 1024) return { error: "3MB 이하 사진만 가능해요." };

  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  if (!user) return { error: "사용자를 찾을 수 없습니다." };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const key = `${user.id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from("avatars")
    .upload(key, buf, { contentType: file.type, upsert: false });
  if (upErr) return { error: "업로드에 실패했습니다." };

  const { data: pub } = db.storage.from("avatars").getPublicUrl(key);
  if (!pub?.publicUrl) return { error: "업로드 URL을 가져오지 못했습니다." };

  await db
    .from("users")
    .update({ avatar_url: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  return { success: true, url: pub.publicUrl };
}

export async function clearAvatar() {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  const db = getAdminClient();
  await db
    .from("users")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("username", session.username);
  return { success: true };
}

export type SocialLinks = {
  instagram?: string;
  x?: string;
  youtube?: string;
  facebook?: string;
  linkedin?: string;
};

export type Education = {
  school: string;
  degree?: string;
  field?: string;
  startYear?: string;
  endYear?: string;
};

export async function updateProfile(
  username: string,
  displayName: string,
  birthDate?: string | null,
  socialLinks?: SocialLinks,
  extra?: { bio?: string | null; education?: Education[]; interests?: string[] },
) {
  const session = await getSession();
  if (!session || session.username !== username) {
    return { error: "권한이 없습니다." };
  }

  const db = getAdminClient();
  const updateData: Record<string, unknown> = {
    display_name: displayName,
    updated_at: new Date().toISOString(),
  };
  if (birthDate !== undefined) {
    updateData.birth_date = birthDate || null;
  }
  if (socialLinks !== undefined) {
    updateData.social_links = socialLinks;
  }
  if (extra) {
    if (extra.bio !== undefined) updateData.bio = extra.bio || null;
    if (extra.education !== undefined) updateData.education = extra.education;
    if (extra.interests !== undefined) updateData.interests = extra.interests;
  }

  const { error } = await db
    .from("users")
    .update(updateData)
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
