/**
 * 오류를 로그용 한 줄로 — 상태·코드·메시지·힌트만. 요청·응답 본문, DB 오류의 details(값이 들어감,
 * 예: 'Key (email)=(…) already exists')는 남기지 않는다(PO 11/21 개인정보).
 * 새 console.error 에 오류 객체를 통째로 넘기지 말 것 — tests/log-safe.test.ts 가 막는다.
 */
export function errorSummary(err: unknown): string {
  if (typeof err === "string") return `status=? ${err}`.slice(0, 300);
  const e = err as {
    name?: string;
    message?: string;
    status?: number;
    statusCode?: number;
    code?: number | string;
    hint?: string | null;
    response?: { status?: number };
  } | null;
  const status = e?.response?.status ?? e?.statusCode ?? e?.status ?? e?.code ?? "?";
  const msg = e?.message ?? e?.name ?? "unknown";
  const hint = e?.hint ? ` (hint: ${e.hint})` : "";
  return `status=${status} ${msg}${hint}`.slice(0, 300);
}
