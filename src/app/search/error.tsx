"use client";

import { RouteError } from "@/components/RouteError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} title="검색 결과를 불러오지 못했어요" />;
}
