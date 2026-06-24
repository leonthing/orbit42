"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/PendingButton";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console; swap for Sentry/observability later.
    console.error("[render error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-charcoal-600">문제가 발생했어요</h1>
        <p className="mt-4 text-charcoal-400">
          잠시 후 다시 시도해주세요. 계속되면 알려주시면 살펴볼게요.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-charcoal-600">오류 코드: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            다시 시도
          </button>
          <Link
            href="/"
            className={buttonClasses({ variant: "secondary", size: "md" })}
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
