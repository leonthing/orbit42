"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createTimeRequest } from "@/lib/time-requests";
import { buttonClasses } from "@/components/PendingButton";
import { useToast } from "@/components/Toast";

const DURATIONS = [30, 60, 90, 120];

/**
 * Reverse market entry point — ask someone to open time even when
 * they have no matching public slot.
 */
export function TimeRequestButton({
  targetUsername,
  loggedIn,
}: {
  targetUsername: string;
  loggedIn: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(60);
  const [budget, setBudget] = useState("");
  const [preferred, setPreferred] = useState("");
  const [sending, startSending] = useTransition();

  if (!loggedIn) {
    return (
      <Link href="/login" className={buttonClasses({ variant: "secondary" })}>
        시간 요청
      </Link>
    );
  }

  const submit = () => {
    if (!message.trim()) return;
    const budgetNum = Number(budget.replace(/[^0-9]/g, ""));
    startSending(async () => {
      const res = await createTimeRequest(targetUsername, {
        message,
        duration_min: duration,
        budget_cents: budgetNum > 0 ? budgetNum * 100 : null,
        preferred_times: preferred || null,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("시간 요청을 보냈어요. 수락되면 알려드릴게요.");
      setOpen(false);
      setMessage("");
      setBudget("");
      setPreferred("");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses({ variant: "secondary" })}
      >
        시간 요청
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-charcoal-100">
              @{targetUsername}에게 시간 요청하기
            </h3>
            <p className="mt-1 text-xs text-charcoal-500">
              열려 있는 슬롯이 없어도 괜찮아요. 수락하면 바로 예약이 잡혀요.
            </p>

            <div className="mt-4 space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="어떤 이야기를 나누고 싶은지 알려주세요"
                rows={3}
                maxLength={2000}
                autoFocus
                className="w-full resize-none rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-charcoal-600 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      duration === d
                        ? "bg-navy-500/15 text-navy-400 ring-1 ring-navy-400/40"
                        : "bg-charcoal-800/50 text-charcoal-400 hover:text-charcoal-200"
                    }`}
                  >
                    {d}분
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={preferred}
                onChange={(e) => setPreferred(e.target.value)}
                placeholder="희망 시간대 (예: 다음 주 평일 저녁, 선택)"
                maxLength={500}
                className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-charcoal-600 focus:outline-none"
              />
              <input
                type="text"
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="제안 금액 ₩ (선택)"
                className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-charcoal-600 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={buttonClasses({ variant: "secondary" })}
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!message.trim() || sending}
                className={buttonClasses()}
              >
                {sending ? "보내는 중…" : "요청 보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
