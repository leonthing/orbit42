import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserId } from "@/lib/db";
import {
  getWeekInsights,
  getWeeklyTrend,
  getWorkHours,
  weekStartMonday,
  WORK_DAY_LABEL,
  type WorkDay,
} from "@/lib/insights";
import {
  PURPOSE_GROUP_COLOR,
  PURPOSE_GROUP_LABEL,
  type PurposeGroup,
} from "@/lib/calendar-settings-types";

export const metadata: Metadata = { title: "Time insights" };
export const dynamic = "force-dynamic";

const TZ = "Asia/Seoul";
const GROUPS: PurposeGroup[] = ["work", "personal", "other"];

function parseWeekParam(raw: string | undefined): Date {
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return weekStartMonday(d);
  }
  return weekStartMonday(new Date());
}

function fmtRange(start: Date, end: Date) {
  const s = start.toLocaleDateString("ko-KR", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
  });
  const e = new Date(end.getTime() - 1).toLocaleDateString("ko-KR", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
  });
  return `${s} – ${e}`;
}

function fmtHours(h: number) {
  if (h < 0.1) return "0h";
  if (h < 10) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round(h)}h`;
}

function weekKey(d: Date) {
  // YYYY-MM-DD in Asia/Seoul for the Monday.
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { week?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.username !== params.username) notFound();
  const userId = await getUserId();
  if (!userId) notFound();

  const weekStart = parseWeekParam(searchParams.week);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  const prevWeek = new Date(weekStart.getTime() - 7 * 24 * 60 * 60_000);
  const nextWeek = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  const thisWeek = weekStartMonday(new Date());
  const isCurrent = weekKey(weekStart) === weekKey(thisWeek);

  const workHours = await getWorkHours(userId);
  const [insights, trend] = await Promise.all([
    getWeekInsights(userId, weekStart, workHours),
    getWeeklyTrend(userId, 4, workHours, new Date()),
  ]);

  const hasWorkingHours = insights.working_hours_total > 0;
  const utilization = hasWorkingHours
    ? Math.min(100, (insights.working_hours_busy / insights.working_hours_total) * 100)
    : 0;

  const workDays = (Object.keys(workHours) as WorkDay[])
    .sort((a, b) => {
      const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
      return order.indexOf(a) - order.indexOf(b);
    })
    .map((d) => WORK_DAY_LABEL[d])
    .join("·");

  const totalTrendMax = Math.max(
    1,
    ...trend.map((t) => t.by_group.work + t.by_group.personal + t.by_group.other),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">시간 인사이트</h1>
          <p className="mt-1 text-xs text-charcoal-500">
            {fmtRange(weekStart, weekEnd)} · 근무시간 {workDays || "설정 안 됨"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <WeekNavLink
            username={params.username}
            week={prevWeek}
            label="← 이전 주"
          />
          {!isCurrent && (
            <Link
              href={`/${params.username}/insights`}
              className="rounded-md border border-charcoal-800/60 bg-charcoal-900/60 px-3 py-1.5 text-xs text-charcoal-300 hover:border-charcoal-700"
            >
              이번 주
            </Link>
          )}
          <WeekNavLink
            username={params.username}
            week={nextWeek}
            label="다음 주 →"
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="총 일정" value={fmtHours(insights.scheduled_hours)} />
        <Stat
          label="업무"
          value={fmtHours(insights.by_group.work)}
          accent={PURPOSE_GROUP_COLOR.work}
        />
        <Stat
          label="업무 외"
          value={fmtHours(insights.by_group.personal)}
          accent={PURPOSE_GROUP_COLOR.personal}
        />
        <Stat
          label="근무시간 여유"
          value={fmtHours(insights.working_hours_free)}
          hint={
            hasWorkingHours
              ? `총 ${fmtHours(insights.working_hours_total)} 중`
              : "근무시간 미설정"
          }
        />
      </section>

      {hasWorkingHours && (
        <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-charcoal-200">
              근무시간 활용도
            </h2>
            <span className="text-xs text-charcoal-500">
              {Math.round(utilization)}% 일정으로 채워짐
            </span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-charcoal-800/60">
            <div
              className="h-full rounded-full bg-red-500"
              style={{ width: `${utilization}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-charcoal-500">
            <span>
              일정 {fmtHours(insights.working_hours_busy)} / 여유{" "}
              {fmtHours(insights.working_hours_free)}
            </span>
            <span>총 {fmtHours(insights.working_hours_total)}</span>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
        <div className="flex items-baseline justify-between border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">
            카테고리별 시간
          </h2>
          <span className="text-xs text-charcoal-500">
            캘린더 용도 기준 · 주간
          </span>
        </div>
        {insights.by_purpose.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-charcoal-500">
            이번 주 일정이 없어요.
          </p>
        ) : (
          <ul className="divide-y divide-charcoal-800/40">
            {insights.by_purpose.map((c) => {
              const pct =
                insights.scheduled_hours > 0
                  ? (c.hours / insights.scheduled_hours) * 100
                  : 0;
              return (
                <li
                  key={c.purpose}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PURPOSE_GROUP_COLOR[c.group] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm text-charcoal-200">
                        {c.label}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-charcoal-600">
                          {PURPOSE_GROUP_LABEL[c.group]}
                        </span>
                      </p>
                      <span className="text-xs font-semibold text-charcoal-300">
                        {fmtHours(c.hours)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-800/60">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: PURPOSE_GROUP_COLOR[c.group],
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
        <div className="flex items-baseline justify-between border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">
            최근 4주 트렌드
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-charcoal-500">
            {GROUPS.map((g) => (
              <span key={g} className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PURPOSE_GROUP_COLOR[g] }}
                />
                {PURPOSE_GROUP_LABEL[g]}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 px-5 py-4">
          {trend.map((point) => {
            const total =
              point.by_group.work + point.by_group.personal + point.by_group.other;
            const hpct = (v: number) => (v / totalTrendMax) * 100;
            const start = new Date(point.week_start);
            const isSelected = weekKey(start) === weekKey(weekStart);
            const label = start.toLocaleDateString("ko-KR", {
              timeZone: TZ,
              month: "numeric",
              day: "numeric",
            });
            return (
              <Link
                key={point.week_start}
                href={`/${params.username}/insights?week=${weekKey(start)}`}
                className={`group flex flex-col items-stretch gap-2 rounded-lg p-2 transition-colors ${
                  isSelected
                    ? "bg-charcoal-800/60"
                    : "hover:bg-charcoal-800/30"
                }`}
              >
                <div className="flex h-32 flex-col justify-end gap-0.5">
                  {GROUPS.filter((g) => point.by_group[g] > 0).map((g) => (
                    <div
                      key={g}
                      style={{
                        height: `${hpct(point.by_group[g])}%`,
                        backgroundColor: PURPOSE_GROUP_COLOR[g],
                        opacity: 0.85,
                      }}
                      className="rounded-sm"
                    />
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-charcoal-500">{label}</p>
                  <p className="text-xs font-semibold text-charcoal-200">
                    {fmtHours(total)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 text-xs text-charcoal-500">
        <p>
          카테고리는 각 캘린더의 <strong className="text-charcoal-300">용도</strong>
          에 따라 자동으로 구분돼요.{" "}
          <Link
            href={`/${params.username}/settings`}
            className="text-red-400 hover:underline"
          >
            설정에서 변경
          </Link>
          하면 과거 일정도 반영돼요.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-3 sm:p-4">
      <div className="flex items-center gap-1.5">
        {accent && (
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
          {label}
        </p>
      </div>
      <p
        className="mt-1 truncate text-lg font-bold text-charcoal-100 sm:text-xl"
        title={value}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-charcoal-600">{hint}</p>}
    </div>
  );
}

function WeekNavLink({
  username,
  week,
  label,
}: {
  username: string;
  week: Date;
  label: string;
}) {
  return (
    <Link
      href={`/${username}/insights?week=${weekKey(week)}`}
      className="rounded-md border border-charcoal-800/60 bg-charcoal-900/60 px-3 py-1.5 text-xs text-charcoal-300 hover:border-charcoal-700"
    >
      {label}
    </Link>
  );
}
