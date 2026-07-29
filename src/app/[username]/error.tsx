"use client";

import { RouteError } from "@/components/RouteError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} title="이 화면을 불러오지 못했어요" />;
}
