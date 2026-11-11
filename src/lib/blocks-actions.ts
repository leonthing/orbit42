"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/blocks 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/blocks";

export async function blockUser(...args: Parameters<typeof impl.blockUser>) {
  return impl.blockUser(...args);
}

export async function unblockUser(...args: Parameters<typeof impl.unblockUser>) {
  return impl.unblockUser(...args);
}
