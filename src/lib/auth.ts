"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "orbit42_session";

export async function login(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || password !== adminPassword) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }
  cookies().set(COOKIE_NAME, "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return { success: true };
}

export async function logout() {
  cookies().delete(COOKIE_NAME);
  return { success: true };
}

export async function isAuthenticated() {
  return cookies().get(COOKIE_NAME)?.value === "authenticated";
}
