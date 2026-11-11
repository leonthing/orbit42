"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/location-buffers 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/location-buffers";

export async function createLocationBuffer(...args: Parameters<typeof impl.createLocationBuffer>) {
  return impl.createLocationBuffer(...args);
}

export async function deleteLocationBuffer(...args: Parameters<typeof impl.deleteLocationBuffer>) {
  return impl.deleteLocationBuffer(...args);
}

export async function updateLocationBuffer(...args: Parameters<typeof impl.updateLocationBuffer>) {
  return impl.updateLocationBuffer(...args);
}
