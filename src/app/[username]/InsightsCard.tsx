import Link from "next/link";
import { PURPOSE_GROUP_COLOR } from "@/lib/calendar-settings-types";
import type { InsightsRange } from "@/lib/insights";

type Props = {
  username: string;
  insights: InsightsRange;
};

function fmtHours(h: number) {
  if (h < 0.1) return "0h";
  if (h < 10) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round(h)}h`;
}

export function InsightsCard({ username, insights }: Props) {
  const hasAnything =
    insights.scheduled_hours > 0 || insights.working_hours_total > 0;
  if (!hasAnything) return null;

  const pct = (v: number, tot: number) => (tot > 0 ? (v / tot) * 100 : 0);
  const total = insights.scheduled_hours || 1;

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="flex items-baseline justify-between border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-200">
          이번 주 시간
        </h2>
        <Link
          href={`/${username}/insights`}
          className="text-xs text-charcoal-500 hover:text-charcoal-300"
        >
          자세히 →
        </Link>
      </div>
      <div className="grid grid-cols-3 divide-x divide-charcoal-800/40">
        <Cell
          label="업무"
          value={fmtHours(insights.by_group.work)}
          accent={PURPOSE_GROUP_COLOR.work}
        />
        <Cell
          label="업무 외"
          value={fmtHours(insights.by_group.personal)}
          accent={PURPOSE_GROUP_COLOR.personal}
        />
        <Cell
          label="근무시간 여유"
          value={fmtHours(insights.working_hours_free)}
          hint={
            insights.working_hours_total > 0
              ? `총 ${fmtHours(insights.working_hours_total)}`
              : "근무시간 미설정"
          }
        />
      </div>
      {insights.scheduled_hours > 0 && (
        <div className="flex h-1.5 overflow-hidden">
          {(["work", "personal", "other"] as const).map((g) => {
            const w = pct(insights.by_group[g], total);
            if (w <= 0) return null;
            return (
              <div
                key={g}
                style={{
                  width: `${w}%`,
                  backgroundColor: PURPOSE_GROUP_COLOR[g],
                  opacity: 0.85,
                }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function Cell({
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
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5">
        {accent && (
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <p className="truncate text-2xs font-semibold uppercase tracking-wider text-charcoal-500">
          {label}
        </p>
      </div>
      <p className="mt-1 truncate text-base font-bold text-charcoal-100">
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-2xs text-charcoal-600">{hint}</p>}
    </div>
  );
}
