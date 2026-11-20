/**
 * 구글 API 오류를 로그용으로 줄인다 — 상태 코드와 구글이 준 사유(errors[].reason·message)만.
 * gaxios 오류를 그대로 console.error 하면 요청 본문(일정 제목·메모)이 로그에 남고, 정작 사유는
 * `error: [Object]` 로 접혀 안 보인다(11/21 구글 일정 수정 400 조사).
 */
export function googleErrorSummary(err: unknown): string {
  const e = err as {
    status?: number;
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: { error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> } } };
  };
  const status = e?.response?.status ?? e?.status ?? e?.code ?? "?";
  const g = e?.response?.data?.error;
  const reasons = (g?.errors ?? [])
    .map((x) => [x.reason, x.message].filter(Boolean).join(": "))
    .filter(Boolean)
    .join(" | ");
  return `status=${status} ${reasons || g?.message || e?.message || "unknown"}`.slice(0, 300);
}

/** "YYYY-MM-DD" 만 있는 값(종일 날짜) */
export function isDateOnly(v: string | null | undefined): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * 외부 호출(Resend·OAuth fetch 등) 오류를 로그용으로 — 상태 코드와 메시지만. 요청·응답 본문은 남기지 않는다.
 */
export function errorSummary(err: unknown): string {
  const e = err as { name?: string; message?: string; status?: number; statusCode?: number; code?: number | string; response?: { status?: number } };
  const status = e?.response?.status ?? e?.statusCode ?? e?.status ?? e?.code ?? "?";
  const msg = typeof err === "string" ? err : e?.message ?? e?.name ?? "unknown";
  return `status=${status} ${msg}`.slice(0, 300);
}
