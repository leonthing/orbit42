import Link from "next/link";
import { Suspense } from "react";
import { getAdminClient } from "@/lib/supabase";
import { getUserId } from "@/lib/db";
import { calendarMonthStats, kstYearMonth, type CalendarMonthStat } from "@/lib/calendar-month-stats";

type CardCal = {
  id: string;
  name: string;
  color: string | null;
  visibility: string;
  goal_title: string | null;
  source: string | null;
  google_calendar_id: string | null;
};

/**
 * 프로필의 캘린더 카드 — 미니 월 그리드로 "이 캘린더를 얼마나 쓰는지"를 보여준다
 * (iOS 프로필의 캘린더 카드와 동일한 개념).
 * 본인은 전체, 팔로워는 followers+public, 그 외에는 public 만 보인다.
 * 개수·막대는 캘린더 화면과 같은 출처(DB + 구글)를 KST 달로 센다(11/22 버그 1, lib/calendar-month-stats).
 * 구글을 기다리는 동안 프로필은 먼저 그리고, 카드 숫자만 나중에 채운다(Suspense).
 */
export async function ProfileCalendarCards({
  username,
  isOwner,
  narrow = false,
}: {
  username: string;
  isOwner: boolean;
  /** PC 프로필 오른쪽 칸(360px)처럼 좁은 자리 — 한 줄에 한 장 */
  narrow?: boolean;
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
    .select("id, name, color, visibility, goal_title, source, google_calendar_id")
    .eq("user_id", target.id as string)
    .in("visibility", allowed)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  const calendars = (cals ?? []) as CardCal[];
  if (calendars.length === 0) return null;

  const { year, month } = kstYearMonth();
  const gridClass = narrow ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

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
      <Suspense
        fallback={
          <CardGrid username={username} calendars={calendars} year={year} month={month} stats={null} className={gridClass} />
        }
      >
        <CardGridWithStats
          ownerId={target.id as string}
          username={username}
          calendars={calendars}
          year={year}
          month={month}
          className={gridClass}
        />
      </Suspense>
    </section>
  );
}

async function CardGridWithStats(props: {
  ownerId: string;
  username: string;
  calendars: CardCal[];
  year: number;
  month: number;
  className: string;
}) {
  const stats = await calendarMonthStats(props.ownerId, props.calendars, props.year, props.month).catch(
    () => null,
  );
  return <CardGrid {...props} stats={stats ?? "failed"} />;
}

function CardGrid({
  username,
  calendars,
  year,
  month,
  stats,
  className,
}: {
  username: string;
  calendars: CardCal[];
  year: number;
  month: number;
  /** null = 아직 세는 중, "failed" = 전체 실패 */
  stats: Map<string, CalendarMonthStat> | null | "failed";
  className: string;
}) {
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (
    <div className={className}>
      {calendars.map((cal) => {
        const st = stats && stats !== "failed" ? stats.get(cal.id) : undefined;
        const failed = stats === "failed" || st?.failed === true;
        const active = new Set<number>(st && !failed ? st.days : []);
        const color = cal.color ?? "#6366f1";
        return (
          <Link
            key={cal.id}
            href={`/${username}/c?calendar=${cal.id}`}
            className="rounded-xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4 transition-colors hover:border-charcoal-700 max-md:rounded-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="truncate text-sm font-semibold text-charcoal-100">{cal.name}</span>
              {cal.visibility === "private" && (
                <span className="ml-auto text-2xs text-charcoal-500">비공개</span>
              )}
            </div>
            {cal.goal_title && (
              <p className="mt-1 truncate text-2xs font-medium" style={{ color }}>
                {cal.goal_title}
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
                    backgroundColor: active.has(i + 1) ? color : "rgb(var(--c-800) / 0.5)",
                  }}
                />
              ))}
            </div>
            <p className="mt-2 text-2xs text-charcoal-500" data-testid="calCardCount">
              {stats === null ? "이번 달 …" : failed ? "불러오지 못했어요" : `이번 달 ${st?.count ?? 0}개`}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
