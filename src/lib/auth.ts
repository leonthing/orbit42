"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const COOKIE_NAME = "orbit42_session";

export async function login(username: string, password: string) {
  const limit = rateLimit(clientKey("login", username), 8, 5 * 60_000);
  if (!limit.ok) {
    return { error: `너무 많은 시도예요. ${limit.retryAfter}초 후 다시 시도해주세요.` };
  }
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

export async function signup(
  username: string,
  password: string,
  email: string,
  displayName?: string,
  inviteCode?: string,
) {
  const limit = rateLimit(clientKey("signup"), 5, 60 * 60_000);
  if (!limit.ok) {
    return { error: `너무 많은 시도예요. ${limit.retryAfter}초 후 다시 시도해주세요.` };
  }
  if (!username || !password || !email) {
    return { error: "아이디, 비밀번호, 이메일을 모두 입력해주세요." };
  }

  // Invite code required for signup.
  const { validateInviteCode } = await import("@/lib/invite");
  const codeResult = await validateInviteCode(inviteCode ?? "");
  if (!codeResult.valid) {
    return { error: codeResult.error };
  }
  if (username.length < 2 || !/^[a-z0-9_-]+$/.test(username)) {
    return { error: "아이디는 2자 이상, 영문 소문자/숫자/하이픈만 가능합니다." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: "이메일 형식이 올바르지 않아요." };
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

  // Check if email already used
  const { data: byEmail } = await db
    .from("users")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();
  if (byEmail) {
    return { error: "이미 사용 중인 이메일입니다." };
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

  // Attach email + default native calendar + send verification.
  const { data: freshUser } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (freshUser) {
    await db
      .from("users")
      .update({ email: normalizedEmail, email_verified: false })
      .eq("id", freshUser.id);
    await db.from("calendars").insert({
      user_id: freshUser.id,
      name: "내 캘린더",
      purpose: "personal",
      color: "#6366f1",
      visibility: "private",
      source: "native",
      is_default: true,
    });
    // Fire-and-forget verification email.
    const { startEmailVerification } = await import("@/lib/account");
    await startEmailVerification(freshUser.id as string, normalizedEmail);

    // Claim the invite code + generate new codes for this user.
    const { claimInviteCode } = await import("@/lib/invite");
    await claimInviteCode(codeResult.id, freshUser.id as string);
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

/**
 * Sign in or sign up via Google. Finds an existing user by email or
 * creates a fresh one with a generated username and a random password.
 * Returns the resolved username so the caller can redirect to /feed.
 */
export async function loginOrSignupWithGoogle(
  email: string,
  displayName: string | null,
): Promise<{ username: string } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "이메일을 가져올 수 없어요." };

  const db = getAdminClient();

  // 1. Existing user with this email?
  const { data: existing } = await db
    .from("users")
    .select("id, username, email_verified")
    .ilike("email", normalized)
    .maybeSingle();

  if (existing?.username) {
    // Google has already verified this email, so promote the flag if
    // it is still false (covers users created before verification
    // feature shipped).
    if (!existing.email_verified) {
      await db
        .from("users")
        .update({ email_verified: true })
        .eq("id", existing.id);
    }
    cookies().set(COOKIE_NAME, JSON.stringify({ username: existing.username }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    return { username: existing.username as string };
  }

  // 2. Fresh signup — generate a unique username from email.
  const base = normalized
    .split("@")[0]
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 20) || "user";
  let username = base;
  for (let i = 0; i < 8; i++) {
    const { data: taken } = await db
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (!taken) break;
    username = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  const randomPassword = `g_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const { error: createErr } = await db.rpc("create_user", {
    p_username: username,
    p_password: randomPassword,
    p_display_name: displayName || username,
  });
  if (createErr) {
    console.error("google signup create_user", createErr);
    return { error: "회원가입에 실패했어요." };
  }

  // Attach email + default native calendar.
  const { data: fresh } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (fresh) {
    await db
      .from("users")
      .update({ email: normalized, email_verified: true })
      .eq("id", fresh.id);
    await db.from("calendars").insert({
      user_id: fresh.id,
      name: "내 캘린더",
      purpose: "personal",
      color: "#6366f1",
      visibility: "private",
      source: "native",
      is_default: true,
    });
  }

  cookies().set(COOKIE_NAME, JSON.stringify({ username }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { username };
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
      "username, display_name, birth_date, bio, avatar_url, social_links, education, experience, interests, email, email_verified, created_at",
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
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return { error: "JPG, PNG, WEBP, GIF 이미지만 가능합니다." };
  }
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

export type Experience = {
  company: string;
  role?: string;
  description?: string;
  startYear?: string;
  endYear?: string;
  current?: boolean;
};

export async function updateProfile(
  username: string,
  displayName: string,
  birthDate?: string | null,
  socialLinks?: SocialLinks,
  extra?: {
    bio?: string | null;
    education?: Education[];
    experience?: Experience[];
    interests?: string[];
  },
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
    if (extra.experience !== undefined) updateData.experience = extra.experience;
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
