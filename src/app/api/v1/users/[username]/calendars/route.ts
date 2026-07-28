import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { isBlockedEitherWay } from "@/lib/blocks";

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
      "id, name, color, purpose, visibility, source, is_default, goal_title, goal_target_hours, goal_deadline, archived_at",
    )
    .eq("user_id", target.id as string)
    .in("visibility", allowed)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  const calendars = cals ?? [];
  if (calendars.length === 0) return Response.json({ calendars: [] });

  // 표시할 달 (기본: 이번 달)
  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get("year")) || now.getFullYear();
  const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const { data: events } = await db
    .from("events")
    .select("calendar_id, start_at")
    .in("calendar_id", calendars.map((c) => c.id as string))
    .gte("start_at", monthStart.toISOString())
    .lte("start_at", monthEnd.toISOString());

  // 캘린더별 "일정 있는 날(1~31)" 집합 — KST 기준.
  const daysByCalendar = new Map<string, Set<number>>();
  for (const e of events ?? []) {
    const day = Number(
      new Date(e.start_at as string).toLocaleDateString("en-CA", {
        timeZone: "Asia/Seoul",
      }).slice(-2),
    );
    if (!Number.isFinite(day)) continue;
    const key = e.calendar_id as string;
    if (!daysByCalendar.has(key)) daysByCalendar.set(key, new Set());
    daysByCalendar.get(key)?.add(day);
  }

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
      activeDays: Array.from(daysByCalendar.get(c.id as string) ?? []).sort(
        (a, b) => a - b,
      ),
      eventCount: (events ?? []).filter((e) => e.calendar_id === c.id).length,
    })),
  });
}
