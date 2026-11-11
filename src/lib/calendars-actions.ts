"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/calendars 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/calendars";

export async function createNativeCalendar(...args: Parameters<typeof impl.createNativeCalendar>) {
  return impl.createNativeCalendar(...args);
}

export async function deleteCalendar(...args: Parameters<typeof impl.deleteCalendar>) {
  return impl.deleteCalendar(...args);
}

export async function updateCalendar(...args: Parameters<typeof impl.updateCalendar>) {
  return impl.updateCalendar(...args);
}
