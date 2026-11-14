/**
 * 처리방침·약관 변경 안내와 시행 (1.7.0, CEO 10/26 확정).
 * - 1.7.0 웹 배포일에 NOTICE_DATE = 배포일(KST), EFFECTIVE_DATE = 배포일 + 7일로 채운다. 비어 있으면 옛 문장만 보인다.
 * - 안내일 ~ 시행일 전날: 페이지 위에 "변경 안내 — 시행일" + 요약, 본문은 옛 문장.
 * - 시행일부터: 새 문장. 페이지는 1시간마다 다시 그려져(revalidate) 배포 없이 바뀐다.
 */
export const LEGAL_NOTICE_DATE: string | null = "2026-10-30"; // 1.7.0 + 1.8.0 통합 개정 안내(10/29 배포가 빠져 10/30으로, 시행은 7일 뒤)
export const LEGAL_EFFECTIVE_DATE: string | null = "2026-11-06";

function kstToday(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/**
 * 1.9.0 처리방침 개정(1:1 대화 + 할 일·후속 일정, Leo 11/12 승인): 안내 11/13, 시행 11/20.
 * 개인정보처리방침만 바뀌고 이용약관은 그대로다.
 */
export const PRIVACY_190_NOTICE_DATE: string | null = "2026-11-13";
export const PRIVACY_190_EFFECTIVE_DATE: string | null = "2026-11-20";

/**
 * 1.10.0 처리방침 개정(글·사진, Leo 11/14 "추천대로" — 문장은 Leo 승인 대기): 안내 11/20, 시행 11/27.
 * 문장 승인 전에는 날짜를 null 로 두면 아무 데도 안 보인다. 승인되면 이 두 값만 그대로 둔 채 배포.
 */
export const PRIVACY_1100_NOTICE_DATE: string | null = "2026-11-20";
export const PRIVACY_1100_EFFECTIVE_DATE: string | null = "2026-11-27";

/**
 * 1.10.0 이용약관 개정(제8조 괴롭힘 금지·무관용 기준과 조치, Leo 11/14 승인): 처리방침과 같은 날 안내·시행.
 * 1.10.0을 미루거나 빼면 이 네 날짜만 바꾸거나 null 로 두면 된다(null 이면 안내·새 문장 모두 안 보임).
 */
export const TERMS_1100_NOTICE_DATE: string | null = "2026-11-20";
export const TERMS_1100_EFFECTIVE_DATE: string | null = "2026-11-27";

export type LegalChange = "none" | "notice" | "effective";

function changeState(notice: string | null, effective: string | null, now: Date): LegalChange {
  if (!notice || !effective) return "none";
  const today = kstToday(now);
  if (today >= effective) return "effective";
  if (today >= notice) return "notice";
  return "none";
}

export function legalChangeState(now: Date = new Date()): LegalChange {
  return changeState(LEGAL_NOTICE_DATE, LEGAL_EFFECTIVE_DATE, now);
}

export function privacy190State(now: Date = new Date()): LegalChange {
  return changeState(PRIVACY_190_NOTICE_DATE, PRIVACY_190_EFFECTIVE_DATE, now);
}

export function privacy1100State(now: Date = new Date()): LegalChange {
  return changeState(PRIVACY_1100_NOTICE_DATE, PRIVACY_1100_EFFECTIVE_DATE, now);
}

export function terms1100State(now: Date = new Date()): LegalChange {
  return changeState(TERMS_1100_NOTICE_DATE, TERMS_1100_EFFECTIVE_DATE, now);
}

/** "2026-11-10" → "2026년 11월 10일" */
export function koDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
