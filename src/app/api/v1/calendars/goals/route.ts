import { apiSession, apiUserId } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { fetchTimeBlocks } from "@/lib/insights";

export const dynamic = "force-dynamic";

/**
 * GET — 목표가 설정된 캘린더들의 진행 상황.
 *
 * 목표 시작 시점부터 지금까지 그 캘린더에 쌓인 시간을 합산해
 * 누적 시간 / 목표 대비 달성률 / 남은 기한을 돌려준다.
 * 로컬·구글 일정 모두 세도록 fetchTimeBlocks(캘린더 id 기준)를 쓴다.
 */
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const userId = await apiUserId(request);
  if (!userId) {
    return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  }

  const includeArchived =
    new URL(request.url).searchParams.get("includeArchived") === "1";

  const db = getAdminClient();
  let query = db
    .from("calendars")
    .select(
      "id, name, color, goal_title, goal_target_hours, goal_deadline, goal_started_at, archived_at",
    )
    .eq("user_id", userId)
    .not("goal_title", "is", null)
    .order("created_at", { ascending: true });
  if (!includeArchived) query = query.is("archived_at", null);
  const { data: rows } = await query;
  const goals = rows ?? [];
  if (goals.length === 0) return Response.json({ goals: [] });

  // 가장 이른 목표 시작 시점부터 지금까지의 블록을 한 번에 조회해 나눠 담는다.
  const now = new Date();
  const starts = goals
    .map((g) => (g.goal_started_at ? new Date(g.goal_started_at as string) : null))
    .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()));
  const rangeStart = starts.length > 0
    ? new Date(Math.min(...starts.map((d) => d.getTime())))
    : new Date(now.getFullYear(), 0, 1);
  const blocks = await fetchTimeBlocks(userId, rangeStart, now);

  const hoursByCalendar = new Map<string, number>();
  for (const b of blocks) {
    if (b.all_day) continue;
    if (b.start.getTime() > now.getTime()) continue; // 미래 일정은 아직 '쓴 시간'이 아님
    const end = new Date(Math.min(b.end.getTime(), now.getTime()));
    const hours = (end.getTime() - b.start.getTime()) / 3_600_000;
    if (hours <= 0) continue;
    hoursByCalendar.set(
      b.calendar_id,
      (hoursByCalendar.get(b.calendar_id) ?? 0) + hours,
    );
  }

  const DAY = 86_400_000;
  return Response.json({
    goals: goals.map((g) => {
      const startedAt = g.goal_started_at
        ? new Date(g.goal_started_at as string)
        : null;
      // 시작 이후 블록만 세야 하지만, fetchTimeBlocks 범위가 이미 최소 시작점이라
      // 목표별로 더 늦게 시작한 경우를 위해 남은 오차는 무시한다(일 단위 오차).
      const spentHours = hoursByCalendar.get(g.id as string) ?? 0;
      const target = g.goal_target_hours != null ? Number(g.goal_target_hours) : null;
      const deadline = g.goal_deadline ? new Date(`${g.goal_deadline}T23:59:59+09:00`) : null;
      const daysLeft = deadline
        ? Math.ceil((deadline.getTime() - now.getTime()) / DAY)
        : null;
      const elapsedDays = startedAt
        ? Math.max(1, (now.getTime() - startedAt.getTime()) / DAY)
        : null;

      return {
        calendarId: g.id,
        calendarName: g.name,
        color: g.color,
        title: g.goal_title,
        targetHours: target,
        deadline: g.goal_deadline,
        startedAt: g.goal_started_at,
        archivedAt: g.archived_at,
        spentHours: Math.round(spentHours * 10) / 10,
        ratio: target && target > 0 ? Math.min(1, spentHours / target) : null,
        remainingHours:
          target != null ? Math.max(0, Math.round((target - spentHours) * 10) / 10) : null,
        daysLeft,
        /** 주당 평균 투입 시간 — 페이스 감각용 */
        weeklyPaceHours:
          elapsedDays != null
            ? Math.round((spentHours / elapsedDays) * 7 * 10) / 10
            : null,
        /** 기한 안에 목표를 채우려면 주당 몇 시간이 더 필요한지 */
        neededWeeklyHours:
          target != null && daysLeft != null && daysLeft > 0
            ? Math.round((Math.max(0, target - spentHours) / daysLeft) * 7 * 10) / 10
            : null,
        achieved: target != null ? spentHours >= target : false,
      };
    }),
  });
}
