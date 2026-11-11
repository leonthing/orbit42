"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/reactions 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/reactions";

export async function getReactionsForMany(...args: Parameters<typeof impl.getReactionsForMany>) {
  return impl.getReactionsForMany(...args);
}

export async function toggleReaction(...args: Parameters<typeof impl.toggleReaction>) {
  return impl.toggleReaction(...args);
}
