import Link from "next/link";
import type { TimeAssetSummary } from "@/lib/time-asset";

/**
 * 시간 자산 대시보드 (웹) — iOS 자산 탭과 같은 데이터·같은 구성.
 * 이번 달 실수입 → 이번 주 판매 현황 → 목표 → 올해 남은 시간 →
 * 지난주 리포트 → 이번 주 시간 사용 → 행동 추천.
 */

function won(value: number) {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function compactWon(value: number) {
  if (value >= 100_000_000) {
    const eok = value / 100_000_000;
    return eok >= 100 ? `₩${Math.round(eok)}억` : `₩${eok.toFixed(1)}억`;
  }
  if (value >= 10_000_000) return `₩${Math.round(value / 10_000).toLocaleString("ko-KR")}만`;
  return won(value);
}

function hours(value: number) {
  return `${Math.round(value * 10) / 10}`;
}

function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-5">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && (
            <h2 className="text-xs font-semibold text-charcoal-500">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Bar({ ratio, color }: { ratio: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-charcoal-800/60">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
          backgroundColor: color ?? "rgb(99 102 241)",
        }}
      />
    </div>
  );
}

export function TimeAssetDashboard({
  summary,
  goals,
  username,
}: {
  summary: TimeAssetSummary;
  goals: Array<{
    calendarId: string;
    title: string;
    color: string;
    spentHours: number;
    targetHours: number | null;
    ratio: number | null;
    daysLeft: number | null;
    weeklyPaceHours: number | null;
    neededWeeklyHours: number | null;
    achieved: boolean;
  }>;
  username: string;
}) {
  const business = summary.business;
  const maxEarn = Math.max(1, ...business.earnTrend.map((e) => e.krw));
  const funnel = business.funnel;
  const soldRatio =
    funnel && funnel.openHours + funnel.bookedHours > 0
      ? funnel.bookedHours / (funnel.openHours + funnel.bookedHours)
      : 0;
  const report = summary.report;
  const year = summary.yearRemaining;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 이번 달 시간으로 번 돈 */}
      <Card title="이번 달 시간으로 번 돈">
        <p className="text-3xl font-bold tracking-tight text-charcoal-100">
          {won(business.monthTotalKrw)}
        </p>
        <p className="mt-1 text-xs text-charcoal-500">
          {business.monthTotalKrw > 0
            ? `슬롯 거래 ${won(business.monthBookedKrw)} · 직접 기록 ${won(business.monthManualKrw)}`
            : "타임슬롯 판매와 일정 수익 기록이 여기에 쌓여요."}
        </p>
        <div className="mt-4 flex h-16 items-end gap-2">
          {business.earnTrend.map((entry) => (
            <div key={entry.month} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-sm ${
                  entry.month === business.monthLabel
                    ? "bg-navy-500"
                    : "bg-charcoal-800/70"
                }`}
                style={{ height: `${Math.max(4, (entry.krw / maxEarn) * 44)}px` }}
              />
              <span className="text-3xs text-charcoal-600">
                {Number(entry.month.split("-")[1])}월
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* 이번 주 판매 현황 */}
      {funnel && (
        <Card
          title="이번 주 판매 현황"
          action={
            <span
              className={`text-xs font-semibold ${soldRatio > 0 ? "text-emerald-400" : "text-charcoal-500"}`}
            >
              {Math.round(soldRatio * 100)}% 판매
            </span>
          }
        >
          <Bar ratio={soldRatio} color="rgb(52 211 153)" />
          <div className="mt-3 flex items-start justify-between text-sm">
            <div>
              <p className="text-xs text-charcoal-500">열린 시간</p>
              <p className="font-semibold text-charcoal-100">
                {hours(funnel.openHours)}시간
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-charcoal-500">예약됨</p>
              <p className="font-semibold text-charcoal-100">
                {hours(funnel.bookedHours)}시간 · {won(funnel.bookedKrw)}
              </p>
            </div>
          </div>
          {funnel.unsoldValueKrw > 0 && (
            <p className="mt-3 flex items-center justify-between gap-2 text-xs text-amber-400">
              아직 안 팔린 시간 {won(funnel.unsoldValueKrw)}어치
              <Link
                href={`/${username}`}
                className="rounded-full bg-navy-500/15 px-2.5 py-1 font-semibold text-navy-400"
              >
                프로필 공유
              </Link>
            </p>
          )}
        </Card>
      )}

      {/* 목표 */}
      {goals.length > 0 && (
        <Card title="목표">
          <div className="space-y-3">
            {goals.map((goal) => (
              <div
                key={goal.calendarId}
                className="rounded-xl bg-charcoal-900/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: goal.color }}
                  />
                  <span className="text-sm font-semibold text-charcoal-100">
                    {goal.title}
                  </span>
                  {goal.achieved && <span className="text-xs text-emerald-400">달성</span>}
                  {goal.daysLeft != null && (
                    <span
                      className={`ml-auto text-xs ${goal.daysLeft < 0 ? "text-amber-400" : "text-charcoal-500"}`}
                    >
                      {goal.daysLeft < 0 ? "기한 지남" : `D-${goal.daysLeft}`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-lg font-bold text-charcoal-100">
                  {hours(goal.spentHours)}시간
                  {goal.targetHours != null && (
                    <span className="ml-1 text-sm font-normal text-charcoal-500">
                      / {hours(goal.targetHours)}시간
                    </span>
                  )}
                </p>
                {goal.ratio != null && (
                  <div className="mt-2">
                    <Bar
                      ratio={goal.ratio}
                      color={goal.achieved ? "rgb(52 211 153)" : goal.color}
                    />
                  </div>
                )}
                <p className="mt-2 text-2xs text-charcoal-500">
                  {goal.achieved
                    ? "목표를 채웠어요. 축하해요!"
                    : goal.neededWeeklyHours != null && goal.neededWeeklyHours > 0
                      ? `주 ${hours(goal.neededWeeklyHours)}시간이면 기한 내 달성 · 현재 주 ${hours(goal.weeklyPaceHours ?? 0)}시간`
                      : `현재 주 ${hours(goal.weeklyPaceHours ?? 0)}시간 페이스`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 올해 남은 시간 */}
      {year && (
        <Card title="올해 남은 시간">
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-charcoal-100">
              약 {year.remainingAwakeHours.toLocaleString("ko-KR")}시간
            </span>
            {year.remainingValueKrw != null && (
              <span className="text-sm font-semibold text-navy-400">
                ≈ {compactWon(year.remainingValueKrw)}
              </span>
            )}
          </p>
          <div className="mt-3">
            <Bar ratio={year.progressRatio} />
          </div>
          <p className="mt-2 text-xs text-charcoal-500">
            {year.year}년이 {Math.round(year.progressRatio * 100)}% 지났어요 · 수면 제외 —
            남은 시간을 어디에 쓸지가 올해의 자산을 정해요.
          </p>
        </Card>
      )}

      {/* 지난주 리포트 */}
      <Card title="지난주 리포트">
        <dl className="space-y-2 text-sm">
          {report.earnedKrw != null && (
            <ReportRow
              label="수입"
              value={won(report.earnedKrw)}
              delta={report.deltaEarnedKrw}
              positiveIsGood
              format={won}
            />
          )}
          <ReportRow
            label="투자 시간"
            value={`${hours(report.investHours)}시간`}
            delta={report.deltaInvestHours}
            positiveIsGood
            format={(v) => `${hours(v)}시간`}
          />
          <ReportRow
            label="잃어버린 시간"
            value={`${hours(report.lostHours)}시간`}
            delta={report.deltaLostHours}
            positiveIsGood={false}
            format={(v) => `${hours(v)}시간`}
          />
        </dl>
      </Card>

      {/* 이번 주 시간 사용 (버킷) */}
      <Card title="이번 주 시간 사용">
        <div className="space-y-3">
          {summary.buckets.map((bucket) => (
            <div key={bucket.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-charcoal-200">{bucket.label}</span>
                <span className="text-charcoal-400">
                  {hours(bucket.hours)}시간
                  {bucket.valueKrw != null && (
                    <span className="ml-2 text-charcoal-500">
                      {won(bucket.valueKrw)}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1">
                <Bar ratio={bucket.ratio} color={bucket.color} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-charcoal-500">
          기록 {hours(summary.scheduledHours)}시간 · 수면{" "}
          {hours(summary.sleepHoursPerWeek)}시간 · 미기록{" "}
          {hours(summary.unrecordedHours)}시간
        </p>
      </Card>

      {/* 행동 추천 */}
      {summary.actions.length > 0 && (
        <Card title="이렇게 활용해 보세요">
          <div className="space-y-3">
            {summary.actions.map((action) => (
              <div key={action.key} className="rounded-xl bg-charcoal-900/40 p-3">
                <p className="text-sm font-semibold text-charcoal-100">
                  {action.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-charcoal-500">
                  {action.body}
                </p>
                <Link
                  href={actionHref(action.target, username)}
                  className="mt-2 inline-block rounded-full bg-navy-500/15 px-3 py-1.5 text-xs font-semibold text-navy-400 hover:bg-navy-500/25"
                >
                  {action.ctaLabel}
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 인사이트 문구 */}
      {summary.messages.length > 0 && (
        <Card title="인사이트">
          <ul className="space-y-2 text-sm text-charcoal-300">
            {summary.messages.map((message, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-navy-400">·</span>
                <span>{message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function actionHref(target: string, username: string) {
  switch (target) {
    case "slots":
      return `/${username}/slots`;
    case "calendar":
      return `/${username}/calendar`;
    case "profile":
      return `/${username}`;
    default:
      return `/${username}/settings`;
  }
}

function ReportRow({
  label,
  value,
  delta,
  positiveIsGood,
  format,
}: {
  label: string;
  value: string;
  delta: number | null;
  positiveIsGood: boolean;
  format: (v: number) => string;
}) {
  const improved = delta != null && delta !== 0 && delta > 0 === positiveIsGood;
  return (
    <div className="flex items-center justify-between">
      <dt className="text-charcoal-500">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="font-semibold text-charcoal-100">{value}</span>
        {delta != null && delta !== 0 && (
          <span
            className={`text-xs font-semibold ${improved ? "text-emerald-400" : "text-amber-400"}`}
          >
            {delta > 0 ? "+" : "−"}
            {format(Math.abs(delta))}
          </span>
        )}
      </dd>
    </div>
  );
}
