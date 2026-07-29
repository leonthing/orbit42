"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type OnboardingStep = {
  key: string;
  label: string;
  href: string;
  done: boolean;
};

const DISMISS_KEY = "orbit42:onboarding-dismissed";

/**
 * "시작하기" checklist shown on the feed until the basics are done.
 * Dismiss only hides it for the current session (sessionStorage) — it
 * comes back next visit until every step is done, so a stray click
 * can't lose it forever. Defaults to visible to avoid a load flash.
 */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const [dismissed, setDismissed] = useState(false);
  // 모바일에서는 접어 둔다 — 캘린더가 홈이 되면서 이 카드가 펼쳐져 있으면
  // 화면의 절반 이상을 먹고 정작 일정이 안 보인다. 데스크톱은 늘 펼친다.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount === steps.length) return null;

  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-100">
            Orbit42 시작하기
          </h2>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {doneCount}/{steps.length} 완료 — 채울수록 더 많은 사람과 연결돼요
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "접기" : "전체 보기"}
          className="rounded-lg p-1 text-charcoal-600 hover:bg-charcoal-800/50 hover:text-charcoal-300 sm:hidden"
        >
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          aria-label="체크리스트 숨기기"
          className="rounded-lg p-1 text-charcoal-600 hover:bg-charcoal-800/50 hover:text-charcoal-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-charcoal-800/60">
        <div
          className="h-full rounded-full bg-navy-400 transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      {/* 접힌 모바일에서는 다음 할 일 한 줄만 보여준다 */}
      {nextStep && !expanded && (
        <Link
          href={nextStep.href}
          className="mt-3 flex items-center gap-2 text-sm font-medium text-charcoal-200 hover:text-charcoal-100 sm:hidden"
        >
          <span className="h-4 w-4 shrink-0 rounded-full border border-charcoal-700" />
          다음: {nextStep.label}
          <svg className="h-3.5 w-3.5 text-charcoal-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      )}

      <ul className={`mt-4 space-y-2 ${expanded ? "block" : "hidden sm:block"}`}>
        {steps.map((s) =>
          s.done ? (
            <li
              key={s.key}
              className="flex items-center gap-2.5 text-sm text-charcoal-600 line-through"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              {s.label}
            </li>
          ) : (
            <li key={s.key}>
              <Link
                href={s.href}
                className="group flex items-center gap-2.5 text-sm text-charcoal-300 hover:text-charcoal-100"
              >
                <span className="h-5 w-5 shrink-0 rounded-full border border-charcoal-700 group-hover:border-navy-400/60" />
                {s.label}
                <svg className="h-3.5 w-3.5 text-charcoal-600 group-hover:text-navy-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
