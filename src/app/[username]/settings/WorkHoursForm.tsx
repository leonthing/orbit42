"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateWorkHours } from "@/lib/insights-actions";
import {
  WORK_DAY_LABEL,
  type WorkDay,
  type WorkHours,
} from "@/lib/insights-types";
import { PendingButton } from "@/components/PendingButton";

const DAY_ORDER: WorkDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type Props = { initial: WorkHours };

export function WorkHoursForm({ initial }: Props) {
  const router = useRouter();
  const [hours, setHours] = useState<WorkHours>(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const toggle = (day: WorkDay) => {
    setHours((prev) => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      else next[day] = { start: "09:00", end: "18:00" };
      return next;
    });
  };

  const setField = (day: WorkDay, k: "start" | "end", v: string) => {
    setHours((prev) => {
      const cur = prev[day];
      if (!cur) return prev;
      return { ...prev, [day]: { ...cur, [k]: v } };
    });
  };

  const save = () => {
    startTransition(async () => {
      await updateWorkHours(hours);
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  const totalMin = DAY_ORDER.reduce((sum, d) => {
    const w = hours[d];
    if (!w) return sum;
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    return sum + Math.max(0, eh * 60 + em - sh * 60 - sm);
  }, 0);
  const totalHours = Math.round((totalMin / 60) * 10) / 10;

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-200">
            근무 시간
          </h2>
          <p className="mt-1 text-xs text-charcoal-500">
            시간 분석과 예약 슬롯의 기본 가용 시간대로 쓰여요. 주당 총{" "}
            <span className="font-semibold text-charcoal-300">
              {totalHours}h
            </span>
          </p>
        </div>
        <PendingButton
          type="button"
          onClick={save}
          pending={pending}
          pendingLabel="저장 중…"
          size="sm"
          className="shrink-0 whitespace-nowrap"
        >
          {savedAt ? "저장됨" : "저장"}
        </PendingButton>
      </div>
      <ul className="divide-y divide-charcoal-800/40">
        {DAY_ORDER.map((d) => {
          const w = hours[d];
          const enabled = !!w;
          return (
            <li
              key={d}
              className="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <button
                type="button"
                onClick={() => toggle(d)}
                className={`flex h-7 w-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                  enabled
                    ? "bg-navy-500 text-white"
                    : "bg-charcoal-800/60 text-charcoal-500 hover:text-charcoal-200"
                }`}
              >
                {WORK_DAY_LABEL[d]}
              </button>
              {enabled ? (
                <div className="flex items-center gap-2 text-sm text-charcoal-200">
                  <input
                    type="time"
                    value={w.start}
                    onChange={(e) => setField(d, "start", e.target.value)}
                    className="rounded-md border border-charcoal-800/60 bg-charcoal-900/60 px-2 py-1 text-xs"
                  />
                  <span className="text-charcoal-600">–</span>
                  <input
                    type="time"
                    value={w.end}
                    onChange={(e) => setField(d, "end", e.target.value)}
                    className="rounded-md border border-charcoal-800/60 bg-charcoal-900/60 px-2 py-1 text-xs"
                  />
                </div>
              ) : (
                <span className="text-xs text-charcoal-600">쉬는 날</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
