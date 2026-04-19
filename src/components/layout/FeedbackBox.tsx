"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "@/lib/feedback";

type Props = {
  collapsed: boolean;
  /** True when the viewer is logged in — email field is hidden then. */
  loggedIn: boolean;
};

export function FeedbackBox({ collapsed, loggedIn }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const pathname = usePathname();

  const close = () => {
    setOpen(false);
    setBody("");
    setEmail("");
    setError(null);
    setDone(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitFeedback({
        body,
        email: loggedIn ? undefined : email || undefined,
        path: pathname,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(true);
      setTimeout(close, 1200);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-xs text-charcoal-400 transition-colors hover:border-charcoal-700 hover:text-charcoal-200 ${
          collapsed ? "justify-center" : ""
        }`}
        title="피드백 보내기"
      >
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
          />
        </svg>
        {!collapsed && <span className="truncate">피드백 보내기</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-base font-semibold text-charcoal-100">
                피드백 보내기
              </h3>
              <button
                type="button"
                onClick={close}
                className="text-xs text-charcoal-500 hover:text-charcoal-200"
              >
                닫기
              </button>
            </div>
            <p className="mb-4 text-xs text-charcoal-500">
              버그, 개선 제안, 아이디어 — 뭐든 자유롭게. 관리자에게 바로
              전달돼요.
            </p>

            {done ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                보내주셔서 고마워요 — 잘 읽어볼게요.
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="여기에 자유롭게 작성해주세요"
                  rows={6}
                  maxLength={4000}
                  required
                  className="w-full resize-none rounded-lg border border-charcoal-700 bg-charcoal-900/60 px-3 py-2.5 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                  autoFocus
                />
                {!loggedIn && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 (회신 받으실 주소, 선택)"
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                  />
                )}

                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-charcoal-600">
                    {body.length} / 4000
                  </span>
                  <button
                    type="submit"
                    disabled={pending || !body.trim()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? "보내는 중…" : "보내기"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
