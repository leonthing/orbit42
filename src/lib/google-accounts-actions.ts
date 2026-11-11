"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/google-accounts 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/google-accounts";

export async function disconnectExtraAccount(...args: Parameters<typeof impl.disconnectExtraAccount>) {
  return impl.disconnectExtraAccount(...args);
}
