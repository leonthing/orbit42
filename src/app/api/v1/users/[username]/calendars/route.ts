import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { isBlockedEitherWay } from "@/lib/blocks";
import { calendarMonthStats, kstYearMonth } from "@/lib/calendar-month-stats";

export const dynamic = "force-dynamic";

/**
 * GET ?year=&month= — 사용자의 캘린더 카드 목록.
 *
 * 본인이면 전체, 팔로워면 followers+public, 그 외에는 public 만 보인다.
 * 각 캘린더의 해당 월 "일정 있는 날짜"를 함께 내려 미니 캘린더로 그릴 수 있게 한다
 * (일정 제목은 주지 않는다 — 프로필 카드에는 밀도만 보여준다).
 */
export async function GET(
  request: Request,
  { params }: { params: { username: string } },
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
  let allowed: string[] = ["private", "followers", "public"];
  if (!isMe) {
    if (target.is_private) {
      return Response.json({ error: "비공개 프로필이에요." }, { status: 403 });
    }
    const myId = await apiUserId(request);
    if (!myId) {
      return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    }
    if (await isBlockedEitherWay(myId, target.id as string)) {
      return Response.json({ error: "프로필을 볼 수 없어요." }, { status: 403 });
    }
    const { data: follow } = await db
      .from("follows")
      .select("id")
      .eq("follower_id", myId)
      .eq("following_id", target.id as string)
      .maybeSingle();
    allowed = follow ? ["followers", "public"] : ["public"];
  }

  const { data: cals } = await db
    .from("calendars")
    .select(
      "id, name, color, purpose, visibility, source, google_calendar_id, is_default, goal_title, goal_target_hours, goal_deadline, archived_at",
    )
    .eq("user_id", target.id as string)
    .in("visibility", allowed)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  const calendars = cals ?? [];
  if (calendars.length === 0) return Response.json({ calendars: [] });

  // 표시할 달 (기본: 이번 달, KST) — 11/22 버그 1: DB 만 세던 것을 캘린더 화면과 같은 출처(DB + 구글)·KST 달로.
  // 응답 모양은 그대로(activeDays·eventCount). 구글이 실패·시간 초과면 그 캘린더는 0·[] (200 유지).
  const url = new URL(request.url);
  const kst = kstYearMonth();
  const year = Number(url.searchParams.get("year")) || kst.year;
  const month = Number(url.searchParams.get("month")) || kst.month;
  const stats = await calendarMonthStats(
    target.id as string,
    calendars.map((c) => ({
      id: c.id as string,
      source: c.source as string | null,
      google_calendar_id: c.google_calendar_id as string | null,
    })),
    year,
    month,
  ).catch(() => null);

  return Response.json({
    year,
    month,
    calendars: calendars.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color ?? "#6366f1",
      purpose: c.purpose ?? "personal",
      visibility: c.visibility,
      source: c.source,
      isDefault: Boolean(c.is_default),
      goalTitle: c.goal_title ?? null,
      goalTargetHours: c.goal_target_hours ?? null,
      goalDeadline: c.goal_deadline ?? null,
      activeDays: stats?.get(c.id as string)?.days ?? [],
      eventCount: stats?.get(c.id as string)?.count ?? 0,
    })),
  });
}
