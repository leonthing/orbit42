"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/auth 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/auth";

export async function changePassword(...args: Parameters<typeof impl.changePassword>) {
  return impl.changePassword(...args);
}

export async function clearAvatar(...args: Parameters<typeof impl.clearAvatar>) {
  return impl.clearAvatar(...args);
}

export async function login(...args: Parameters<typeof impl.login>) {
  return impl.login(...args);
}

export async function logout(...args: Parameters<typeof impl.logout>) {
  return impl.logout(...args);
}

export async function signup(...args: Parameters<typeof impl.signup>) {
  return impl.signup(...args);
}

export async function updateProfile(...args: Parameters<typeof impl.updateProfile>) {
  return impl.updateProfile(...args);
}

export async function uploadAvatar(...args: Parameters<typeof impl.uploadAvatar>) {
  return impl.uploadAvatar(...args);
}
