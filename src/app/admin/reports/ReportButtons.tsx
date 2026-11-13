"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { handleReport } from "@/lib/admin-actions";

const LABEL = { block: "차단", hide: "숨김", ignore: "무시" } as const;
const CONFIRM = {
  block: "신고한 사람 쪽에서 상대를 차단할까요? 대화·예약이 막히고 팔로우가 풀려요.",
  hide: "신고된 메시지를 지울까요? 양쪽 화면에서 사라지고 신고 사본만 남아요.",
  ignore: "조치 없이 처리 완료로 둘까요?",
} as const;

export function ReportButtons({ id, canHide }: { id: string; canHide: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: keyof typeof LABEL) => {
    if (!window.confirm(CONFIRM[action])) return;
    start(async () => {
      const r = await handleReport(id, action);
      setError("error" in r ? r.error : null);
      router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["block", "hide", "ignore"] as const).map((a) => (
        <button
          key={a}
          type="button"
          disabled={pending || (a === "hide" && !canHide)}
          onClick={() => run(a)}
          className={`rounded-lg px-2.5 py-1 text-2xs font-medium disabled:opacity-40 ${
            a === "ignore"
              ? "border border-charcoal-800/60 text-charcoal-400 hover:text-charcoal-200"
              : "bg-red-500/15 text-red-300 hover:bg-red-500/25"
          }`}
        >
          {LABEL[a]}
        </button>
      ))}
      {error && <span className="text-2xs text-red-400">{error}</span>}
    </div>
  );
}
