"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/notification-prefs 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/notification-prefs";

export async function setPref(...args: Parameters<typeof impl.setPref>) {
  return impl.setPref(...args);
}
