"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/messages 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/messages";

export async function markRead(...args: Parameters<typeof impl.markRead>) {
  return impl.markRead(...args);
}

export async function sendMessage(...args: Parameters<typeof impl.sendMessage>) {
  return impl.sendMessage(...args);
}

export async function startConversation(...args: Parameters<typeof impl.startConversation>) {
  return impl.startConversation(...args);
}
