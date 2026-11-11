"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/event-completions 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/event-completions";

export async function getCompletedKeys(...args: Parameters<typeof impl.getCompletedKeys>) {
  return impl.getCompletedKeys(...args);
}

export async function toggleEventCompletion(...args: Parameters<typeof impl.toggleEventCompletion>) {
  return impl.toggleEventCompletion(...args);
}
