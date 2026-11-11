"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/notifications 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/notifications";

export async function listNotifications(...args: Parameters<typeof impl.listNotifications>) {
  return impl.listNotifications(...args);
}

export async function markAllNotificationsRead(...args: Parameters<typeof impl.markAllNotificationsRead>) {
  return impl.markAllNotificationsRead(...args);
}

export async function markNotificationRead(...args: Parameters<typeof impl.markNotificationRead>) {
  return impl.markNotificationRead(...args);
}

export async function unreadNotificationCount(...args: Parameters<typeof impl.unreadNotificationCount>) {
  return impl.unreadNotificationCount(...args);
}
