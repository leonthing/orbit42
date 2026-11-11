"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/follows 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/follows";

export async function follow(...args: Parameters<typeof impl.follow>) {
  return impl.follow(...args);
}

export async function unfollow(...args: Parameters<typeof impl.unfollow>) {
  return impl.unfollow(...args);
}
