"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/menus 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/menus";

export async function createMenu(...args: Parameters<typeof impl.createMenu>) {
  return impl.createMenu(...args);
}

export async function deleteMenu(...args: Parameters<typeof impl.deleteMenu>) {
  return impl.deleteMenu(...args);
}

export async function setSlotMenus(...args: Parameters<typeof impl.setSlotMenus>) {
  return impl.setSlotMenus(...args);
}

export async function updateMenu(...args: Parameters<typeof impl.updateMenu>) {
  return impl.updateMenu(...args);
}
