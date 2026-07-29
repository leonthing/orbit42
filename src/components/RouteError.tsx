"use client";

import { useEffect } from "react";
import { buttonClasses } from "@/components/PendingButton";

/**
 * 세그먼트 단위 에러 표시.
 *
 * 루트 `app/error.tsx` 는 화면 전체를 대체해서 사이드바·하단탭까지 사라진다.
 * 셸 레이아웃이 있는 세그먼트(피드·탐색·검색·메시지·알림·프로필)에서는
 * 이 카드만 본문 자리에 띄워, 실패한 화면만 다시 시도하고 다른 곳으로는
 * 그대로 이동할 수 있게 한다.
 */
export function RouteError({
  error,
  reset,
  title = "이 화면을 불러오지 못했어요",
  body = "잠시 후 다시 시도해 주세요. 계속되면 알려주시면 살펴볼게요.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  body?: string;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="rounded-xl border border-dashed border-charcoal-800/60 bg-charcoal-900/20 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-800/60 text-charcoal-400">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m0 3.75h.008M10.34 3.94l-8.1 14.02A1.5 1.5 0 0 0 3.54 20.2h16.92a1.5 1.5 0 0 0 1.3-2.24l-8.1-14.02a1.5 1.5 0 0 0-2.6 0Z"
          />
        </svg>
      </div>
      <p className="text-base font-semibold text-charcoal-200">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-charcoal-500">
        {body}
      </p>
      {error.digest && (
        <p className="mt-2 text-2xs text-charcoal-600">
          오류 코드: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className={`mt-5 ${buttonClasses({ variant: "primary", size: "md" })}`}
      >
        다시 시도
      </button>
    </div>
  );
}
