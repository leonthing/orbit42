"use client";

// 리포트 휴대폰 — iOS 1.10.0 리포트 탭과 같은 순서(웹 묶음 2, 11/21):
// 시간으로 번 돈(주/월/년) → 이번 주 판매 현황 → 지난주 리포트 → 만족도 → '더 보기'

import { LineIcon } from "@/components/LineIcon";
import { useEffect, useState } from "react";
import type { EarnPeriod, EarnPeriodStat } from "@/lib/time-asset";

const PERIOD_KEY = "orbit42.earnPeriod";
const LABEL: Record<EarnPeriod, string> = { week: "주", month: "월", year: "년" };
const TITLE: Record<EarnPeriod, string> = {
  week: "이번 주 시간으로 번 돈",
  month: "이번 달 시간으로 번 돈",
  year: "올해 시간으로 번 돈",
};
const BOOKED = "#6366f1";
const MANUAL = "#f59e0b";
const SALARY = "#64748b";

function won(v: number) {
  return `₩${Math.round(v).toLocaleString("ko-KR")}`;
}

/** iOS barLabel: 주는 'MM/DD', 월·년은 'N월' */
function barLabel(period: EarnPeriod, key: string) {
  const parts = key.split("-");
  if (period === "week" && parts.length === 3) return `${Number(parts[1])}/${Number(parts[2])}`;
  return parts.length >= 2 ? `${Number(parts[1])}월` : key;
}

export function EarnCard({
  periods,
  hasSalary,
  monthLabel,
}: {
  periods: Record<EarnPeriod, EarnPeriodStat>;
  hasSalary: boolean;
  monthLabel?: string;
}) {
  const [period, setPeriod] = useState<EarnPeriod>("month");
  useEffect(() => {
    try {
      const v = localStorage.getItem(PERIOD_KEY);
      if (v === "week" || v === "month" || v === "year") setPeriod(v);
    } catch {}
  }, []);
  const pick = (p: EarnPeriod) => {
    setPeriod(p);
    try {
      localStorage.setItem(PERIOD_KEY, p);
    } catch {}
  };
  const stat = periods[period];
  const max = Math.max(1, ...stat.trend.map((t) => t.krw));
  return (
    <section className="rounded-2xl bg-[rgb(var(--bg-surface))] p-4" data-testid="earnCard">
      <div role="tablist" aria-label="기간" className="grid grid-cols-3 rounded-lg bg-charcoal-800/40 p-0.5">
        {(["week", "month", "year"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => pick(p)}
            className={`min-h-9 rounded-md text-sm font-medium ${period === p ? "bg-[rgb(var(--bg-surface))] text-charcoal-100 shadow-sm" : "text-charcoal-500"}`}
          >
            {LABEL[p]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold text-charcoal-500">{TITLE[period]}</p>
      <p className="mt-1 text-[30px] font-bold leading-tight tracking-tight text-charcoal-100 tabular-nums" data-testid="earnTotal">
        {won(stat.totalKrw)}
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        {[
          { label: "Orbit 예약으로 번 돈", krw: stat.bookedKrw, color: BOOKED },
          { label: "일정에 기록한 돈", krw: stat.manualKrw, color: MANUAL },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            <dt className="text-charcoal-500">{r.label}</dt>
            <dd className="ml-auto tabular-nums text-charcoal-200">{won(r.krw)}</dd>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: SALARY }} />
          <dt className="text-charcoal-500">급여</dt>
          <dd className="ml-auto tabular-nums text-charcoal-200">{hasSalary ? won(stat.salaryKrw) : <span className="text-charcoal-500">앱에서 설정</span>}</dd>
        </div>
      </dl>
      <div className="mt-4 flex h-[62px] items-end gap-2" aria-hidden>
        {stat.trend.map((t) => {
          const current = t.key === stat.current || (period === "year" && t.key === monthLabel);
          const h = (v: number) => (v <= 0 ? 0 : Math.max(3, (v / max) * 46));
          return (
            <div key={t.key} className="flex flex-1 flex-col items-center gap-1">
              <div className={`flex w-full max-w-7 flex-col-reverse overflow-hidden rounded ${current ? "" : "opacity-45"}`} style={{ height: Math.max(2, h(t.krw)) }}>
                {t.krw <= 0 ? (
                  <div className="h-0.5 w-full bg-charcoal-700" />
                ) : (
                  <>
                    <div style={{ height: `${(t.bookedKrw / t.krw) * 100}%`, background: BOOKED }} />
                    <div style={{ height: `${(t.manualKrw / t.krw) * 100}%`, background: MANUAL }} />
                    <div style={{ height: `${(t.salaryKrw / t.krw) * 100}%`, background: SALARY }} />
                  </>
                )}
              </div>
              <span className={`text-[10px] leading-none ${current ? "font-semibold text-charcoal-200" : "text-charcoal-400"}`}>{barLabel(period, t.key)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type RatingWeek = { average: number | null; count: number };
type RatedItem = { eventId: string; title: string | null; startAt: string | null; calendarId: string | null; rating: number; ratingNote: string | null; missing: boolean };

export function RatingsCard({
  summary,
  calendars,
}: {
  summary: {
    weeks: number;
    thisWeek: RatingWeek;
    lastWeek: RatingWeek;
    byCalendar: Array<{ calendarId: string | null; average: number | null; count: number }>;
    top: RatedItem[];
    bottom: RatedItem[];
    total?: number;
  } | null;
  calendars: Array<{ id: string; name: string; color: string }>;
}) {
  const [all, setAll] = useState(false);
  const cal = (id: string | null) => calendars.find((c) => c.id === id);
  const fmt = (v: number | null) => (v == null ? "–" : v.toFixed(1));
  const empty = !summary || (summary.thisWeek.count === 0 && summary.lastWeek.count === 0 && summary.byCalendar.length === 0);
  return (
    <section className="rounded-2xl bg-[rgb(var(--bg-surface))] p-4" data-testid="ratingsCard">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-charcoal-100">만족도</h2>
        <span className="inline-flex items-center gap-1 text-xs text-charcoal-500"><LineIcon name="lock" /> 나만 봐요</span>
        {!empty && (
          <button type="button" onClick={() => setAll((v) => !v)} className="ml-auto min-h-9 text-sm font-medium text-navy-500">
            {all ? "접기" : "모두 보기"}
          </button>
        )}
      </div>
      {!summary ? (
        <p className="mt-2 text-sm text-charcoal-500">만족도를 불러오지 못했어요.</p>
      ) : empty ? (
        <p className="mt-2 text-sm text-charcoal-500">일정을 완료로 표시하면 만족도를 하트로 남길 수 있어요. 남긴 만족도가 여기 모여요.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["이번 주", summary.thisWeek],
              ["지난주", summary.lastWeek],
            ].map(([t, w]) => (
              <div key={t as string} className="rounded-xl bg-charcoal-800/30 p-3">
                <p className="text-xs text-charcoal-500">{t as string}</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-pink-500">♥</span>
                  <span className="text-xl font-semibold tabular-nums text-charcoal-100">{fmt((w as RatingWeek).average)}</span>
                  <span className="text-xs text-charcoal-500">{(w as RatingWeek).count}개</span>
                </p>
              </div>
            ))}
          </div>
          {summary.byCalendar.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-charcoal-500">캘린더별 평균 · 지난 {summary.weeks}주</p>
              <ul className="mt-1">
                {summary.byCalendar.map((r) => (
                  <li key={r.calendarId ?? "none"} className="flex items-center gap-2 py-1 text-sm">
                    <span className="h-2 w-2 rounded-full" style={{ background: cal(r.calendarId)?.color ?? "#94a3b8" }} />
                    <span className="min-w-0 flex-1 truncate text-charcoal-200">{cal(r.calendarId)?.name ?? (r.calendarId == null ? "지워진 일정" : "다른 캘린더")}</span>
                    <span className="text-pink-500">♥</span>
                    <span className="tabular-nums text-charcoal-200">{fmt(r.average)}</span>
                    <span className="w-8 text-right text-xs text-charcoal-500">{r.count}개</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {all && (
            <div className="mt-3 space-y-3 border-t border-charcoal-800/40 pt-3" data-testid="ratingsAll">
              <p className="text-xs text-charcoal-500">지난 {summary.weeks}주 동안 남긴 만족도예요. 나만 볼 수 있어요.</p>
              {[
                ["높은 만족도", summary.top, "아직 4개 이상 준 일정이 없어요."],
                ["낮은 만족도", summary.bottom, "2개 이하로 준 일정이 없어요."],
              ].map(([t, list, emptyText]) => (
                <div key={t as string}>
                  <p className="mb-1 text-sm font-medium text-charcoal-200">{t as string}</p>
                  {(list as RatedItem[]).length === 0 ? (
                    <p className="text-xs text-charcoal-500">{emptyText as string}</p>
                  ) : (
                    <ul>
                      {(list as RatedItem[]).map((it) => (
                        <li key={it.eventId} className="py-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-charcoal-200">{it.missing ? "지워진 일정" : it.title}</span>
                            <span className="text-pink-500" aria-label={`만족도 하트 ${it.rating}개`}>
                              {"♥".repeat(it.rating)}
                            </span>
                          </div>
                          <p className="text-xs text-charcoal-500">
                            {[cal(it.calendarId)?.name, it.startAt ? new Date(it.startAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) : null].filter(Boolean).join(" · ")}
                          </p>
                          {it.ratingNote && <p className="line-clamp-2 text-xs text-charcoal-500">{it.ratingNote}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** 휴대폰: 나머지는 '더 보기'로 접는다(iOS). 데스크톱은 늘 펼침. */
export function MoreToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mx-auto flex min-h-11 items-center gap-1 px-4 text-sm font-medium text-navy-500 md:hidden"
        data-testid="reportMore"
      >
        {open ? "접기" : "더 보기"}
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <div className={`space-y-6 ${open ? "" : "max-md:hidden"}`}>{children}</div>
    </>
  );
}
