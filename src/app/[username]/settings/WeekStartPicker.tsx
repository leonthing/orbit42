"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import type { WeekStart } from "@/lib/week-start";
import { updateWeekStart } from "./week-start-actions";

/** 캘린더 주 시작 요일 — 월·분기·연·주간 보기와 사이드바 달력에 함께 적용된다. */
export function WeekStartPicker({ initial }: { initial: WeekStart }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState<WeekStart>(initial);
  const [, start] = useTransition();
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <h2 className="text-sm font-semibold text-charcoal-200">주 시작 요일</h2>
      <p className="mt-1 text-xs text-charcoal-500">캘린더의 한 주를 어느 요일부터 보여줄지 정해요.</p>
      <Segmented
        className="mt-3 max-w-xs"
        value={value}
        onChange={(v) => {
          setValue(v);
          start(async () => {
            const r = await updateWeekStart(v);
            if ("error" in r && r.error) {
              toast.error(r.error);
              setValue(initial);
            } else {
              toast.success(v === "sun" ? "일요일부터 시작해요" : "월요일부터 시작해요");
              router.refresh();
            }
          });
        }}
        items={[
          { value: "sun", label: "일요일" },
          { value: "mon", label: "월요일" },
        ]}
      />
    </div>
  );
}
