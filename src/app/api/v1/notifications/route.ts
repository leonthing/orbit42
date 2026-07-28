import { apiSession } from "@/lib/api-auth";
import {
  listNotifications,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

// GET — 내 알림 목록 + 안 읽은 개수 (lib 는 getSession Bearer 폴백을 탄다)
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(50),
    unreadNotificationCount(),
  ]);
  return Response.json({
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      actor: n.actor
        ? {
            username: n.actor.username,
            displayName: n.actor.display_name,
            avatarUrl: n.actor.avatar_url,
          }
        : null,
      readAt: n.read_at,
      createdAt: n.created_at,
    })),
  });
}

// POST { id? } — id 가 있으면 해당 알림, 없으면 전체 읽음 처리
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const result = body.id
    ? await markNotificationRead(body.id)
    : await markAllNotificationsRead();
  if (result && "error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
