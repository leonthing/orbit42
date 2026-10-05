"use client";

import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/PendingButton";
import { useToast } from "@/components/Toast";
import { updatePaymentInstructions } from "./payment-actions";

/**
 * 계좌이체 안내. 적어 두면 유료 슬롯 예약은 '입금 대기'로 들어오고, 게스트는
 * 완료 화면과 메일에서 이 안내를 받는다. 입금을 확인해 확정하면 끝, 24시간 안에
 * 확인되지 않으면 자동 취소된다.
 */
export function PaymentInstructionsForm({ initial }: { initial: string | null }) {
  const toast = useToast();
  const [text, setText] = useState(initial ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <h2 className="text-sm font-semibold text-charcoal-200">결제 안내 (계좌이체)</h2>
      <p className="mt-1 text-xs leading-relaxed text-charcoal-500">
        유료 세션을 예약받으면 게스트에게 이 안내가 보여요. 입금을 확인하고 &lsquo;확정&rsquo;을 누르면 끝이에요.
        24시간 안에 확인되지 않은 예약은 자동으로 취소되고 시간이 다시 열려요.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder={"예) 국민은행 123-456-789012 홍길동\n또는 토스·카카오페이 송금 링크"}
        className="mt-3 w-full rounded-lg border border-charcoal-800/70 bg-[rgb(var(--bg-base))] px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-400 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-2xs text-charcoal-500">예약한 게스트에게만 보여요.</p>
        <button
          type="button"
          disabled={pending}
          className={buttonClasses({ size: "sm" })}
          onClick={() =>
            start(async () => {
              const r = await updatePaymentInstructions(text);
              if ("error" in r && r.error) toast.error(r.error);
              else toast.success(text.trim() ? "결제 안내를 저장했어요" : "결제 안내를 지웠어요");
            })
          }
        >
          저장
        </button>
      </div>
    </div>
  );
}
