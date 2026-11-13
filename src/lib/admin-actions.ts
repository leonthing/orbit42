"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/admin 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/admin";

export async function adminDeleteUser(...args: Parameters<typeof impl.adminDeleteUser>) {
  return impl.adminDeleteUser(...args);
}

export async function handleReport(...args: Parameters<typeof import("@/lib/admin-reports").handleReport>) {
  const { handleReport: run } = await import("@/lib/admin-reports");
  return run(...args);
}
