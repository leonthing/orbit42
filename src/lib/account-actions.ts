"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/account 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/account";

export async function deleteMyAccount(...args: Parameters<typeof impl.deleteMyAccount>) {
  return impl.deleteMyAccount(...args);
}

export async function requestPasswordReset(...args: Parameters<typeof impl.requestPasswordReset>) {
  return impl.requestPasswordReset(...args);
}

export async function resendVerificationEmail(...args: Parameters<typeof impl.resendVerificationEmail>) {
  return impl.resendVerificationEmail(...args);
}

export async function resetPassword(...args: Parameters<typeof impl.resetPassword>) {
  return impl.resetPassword(...args);
}
