/**
 * 명함 기능 로그 — 오류 객체를 통째로 찍지 않는다.
 * googleapis(Gaxios) 오류에는 요청 헤더(Bearer 토큰)·본문(연락처 이름·번호·메일, 토큰 교환 때 code·client_secret)이 들어 있다.
 * 남기는 것: 어디서, HTTP 상태, 구글 오류 상태·사유 코드뿐.
 */
export function safeErr(e: unknown): string {
  const x = e as {
    name?: string;
    code?: unknown;
    status?: unknown;
    response?: { status?: number; data?: { error?: { status?: string; errors?: { reason?: string }[] } | string } };
  };
  const status = x?.response?.status ?? x?.status ?? (typeof x?.code === "number" ? x.code : undefined);
  const d = x?.response?.data?.error;
  const gStatus = typeof d === "string" ? d : d?.status;
  const reason = typeof d === "object" ? d?.errors?.[0]?.reason : undefined;
  // 토큰 교환 오류는 'invalid_grant' 같은 짧은 코드만
  const code = typeof x?.code === "string" && /^[A-Za-z_]{1,40}$/.test(x.code) ? x.code : undefined;
  return [x?.name ?? "Error", status, gStatus, reason, code].filter((v) => v !== undefined && v !== "").join(" ");
}

export function logCardsError(where: string, e: unknown) {
  console.error(`cards ${where}: ${safeErr(e)}`);
}
