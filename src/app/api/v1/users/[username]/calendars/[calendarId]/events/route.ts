import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { getPublicEvents } from "@/lib/public-calendar";
import { isBlockedEitherWay } from "@/lib/blocks";

export const dynamic = "force-dynamic";

/**
 * GET ?year=&month= — 특정 캘린더의 한 달 일정.
 *
 * 가시성은 웹과 같은 규칙(`getPublicEvents` → `listVisibleCalendars`):
 * 본인은 전체, 팔로워는 followers+public, 그 외에는 public 캘린더만.
 * 세션은 Bearer 폴백을 타므로 모바일에서도 그대로 동작한다.
 */
export async function GET(
  request: Request,
  { params }: { params: { username: string; calendarId: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const db = getAdminClient();
  const { data: target } = await db
    .from("users")
    .select("id, username, is_private")
    .eq("username", params.username)
    .maybeSingle();
  if (!target) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const isMe = session.username === target.username;
  if (!isMe) {
    if (target.is_private) {
      return Response.json({ error: "비공개 프로필이에요." }, { status: 403 });
    }
    const myId = await apiUserId(request);
    if (myId && (await isBlockedEitherWay(myId, target.id as string))) {
      return Response.json({ error: "프로필을 볼 수 없어요." }, { status: 403 });
    }
  }

  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get("year")) || now.getFullYear();
  const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;
  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // 캘린더 메타 (이름·색·목표)
  const { data: cal } = await db
    .from("calendars")
    .select("id, name, color, visibility, goal_title, goal_target_hours")
    .eq("id", params.calendarId)
    .eq("user_id", target.id as string)
    .maybeSingle();
  if (!cal) {
    return Response.json({ error: "캘린더를 찾을 수 없어요." }, { status: 404 });
  }

  const events = await getPublicEvents(
    params.username,
    rangeStart,
    rangeEnd,
    [params.calendarId],
  );

  return Response.json({
    year,
    month,
    calendar: {
      id: cal.id,
      name: cal.name,
      color: cal.color ?? "#6366f1",
      visibility: cal.visibility,
      goalTitle: cal.goal_title ?? null,
      goalTargetHours: cal.goal_target_hours ?? null,
    },
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.start_at,
      endAt: e.end_at,
      allDay: e.all_day,
      tentative: e.tentative,
    })),
  });
}
