import Link from "next/link";
import { getAdminClient } from "@/lib/supabase";
import { getUserId } from "@/lib/db";

/**
 * 프로필의 캘린더 카드 — 미니 월 그리드로 "이 캘린더를 얼마나 쓰는지"를 보여준다
 * (iOS 프로필의 캘린더 카드와 동일한 개념).
 * 본인은 전체, 팔로워는 followers+public, 그 외에는 public 만 보인다.
 */
export async function ProfileCalendarCards({
  username,
  isOwner,
}: {
  username: string;
  isOwner: boolean;
}) {
  const db = getAdminClient();
  const { data: target } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (!target) return null;

  let allowed = ["public"];
  if (isOwner) {
    allowed = ["public", "followers", "private"];
  } else {
    const viewerId = await getUserId();
    if (viewerId) {
      const { data: follow } = await db
        .from("follows")
        .select("id")
        .eq("follower_id", viewerId)
        .eq("following_id", target.id as string)
        .maybeSingle();
      if (follow) allowed = ["public", "followers"];
    }
  }

  const { data: cals } = await db
    .from("calendars")
    .select("id, name, color, visibility, goal_title")
    .eq("user_id", target.id as string)
    .in("visibility", allowed)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  const calendars = cals ?? [];
  if (calendars.length === 0) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const { data: events } = await db
    .from("events")
    .select("calendar_id, start_at")
    .in("calendar_id", calendars.map((c) => c.id as string))
    .gte("start_at", monthStart.toISOString())
    .lte("start_at", monthEnd.toISOString());

  const daysByCalendar = new Map<string, Set<number>>();
  for (const e of events ?? []) {
    const day = Number(
      new Date(e.start_at as string)
        .toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
        .slice(-2),
    );
    if (!Number.isFinite(day)) continue;
    const key = e.calendar_id as string;
    if (!daysByCalendar.has(key)) daysByCalendar.set(key, new Set());
    daysByCalendar.get(key)?.add(day);
  }

  const dayCount = new Date(year, month, 0).getDate();
  const leading = new Date(year, month - 1, 1).getDay();

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-charcoal-500">
          {isOwner ? "내 캘린더" : "캘린더"}
        </h2>
        {isOwner && (
          <Link
            href={`/${username}/settings`}
            className="text-xs font-semibold text-navy-400 hover:text-navy-300"
          >
            관리
          </Link>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {calendars.map((cal) => {
          const active = daysByCalendar.get(cal.id as string) ?? new Set<number>();
          const color = (cal.color as string) ?? "#6366f1";
          return (
            <Link
              key={cal.id as string}
              href={`/${username}/c?calendar=${cal.id}`}
              className="rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4 transition-colors hover:border-charcoal-700"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-sm font-semibold text-charcoal-100">
                  {cal.name as string}
                </span>
                {cal.visibility === "private" && (
                  <span className="ml-auto text-[10px] text-charcoal-600">비공개</span>
                )}
              </div>
              {cal.goal_title && (
                <p
                  className="mt-1 truncate text-[11px] font-medium"
                  style={{ color }}
                >
                  {cal.goal_title as string}
                </p>
              )}
              <div className="mt-3 grid grid-cols-7 gap-1">
                {Array.from({ length: leading }).map((_, i) => (
                  <span key={`lead-${i}`} className="h-2" />
                ))}
                {Array.from({ length: dayCount }).map((_, i) => (
                  <span
                    key={i}
                    className="h-2 rounded-full"
                    style={{
                      backgroundColor: active.has(i + 1)
                        ? color
                        : "rgb(var(--c-800) / 0.5)",
                    }}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-charcoal-500">
                이번 달{" "}
                {(events ?? []).filter((e) => e.calendar_id === cal.id).length}개
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
