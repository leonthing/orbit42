"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/time-requests 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/time-requests";

export async function acceptTimeRequest(...args: Parameters<typeof impl.acceptTimeRequest>) {
  return impl.acceptTimeRequest(...args);
}

export async function createTimeRequest(...args: Parameters<typeof impl.createTimeRequest>) {
  return impl.createTimeRequest(...args);
}

export async function declineTimeRequest(...args: Parameters<typeof impl.declineTimeRequest>) {
  return impl.declineTimeRequest(...args);
}
