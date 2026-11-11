"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/mutual-availability 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/mutual-availability";

export async function findMyConflicts(...args: Parameters<typeof impl.findMyConflicts>) {
  return impl.findMyConflicts(...args);
}
