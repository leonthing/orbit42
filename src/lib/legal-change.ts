/**
 * 처리방침·약관 변경 안내와 시행 (1.7.0, CEO 10/26 확정).
 * - 1.7.0 웹 배포일에 NOTICE_DATE = 배포일(KST), EFFECTIVE_DATE = 배포일 + 7일로 채운다. 비어 있으면 옛 문장만 보인다.
 * - 안내일 ~ 시행일 전날: 페이지 위에 "변경 안내 — 시행일" + 요약, 본문은 옛 문장.
 * - 시행일부터: 새 문장. 페이지는 1시간마다 다시 그려져(revalidate) 배포 없이 바뀐다.
 */
export const LEGAL_NOTICE_DATE: string | null = null; // 예: "2026-11-03"
export const LEGAL_EFFECTIVE_DATE: string | null = null; // 예: "2026-11-10"

function kstToday(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function legalChangeState(now: Date = new Date()): "none" | "notice" | "effective" {
  if (!LEGAL_NOTICE_DATE || !LEGAL_EFFECTIVE_DATE) return "none";
  const today = kstToday(now);
  if (today >= LEGAL_EFFECTIVE_DATE) return "effective";
  if (today >= LEGAL_NOTICE_DATE) return "notice";
  return "none";
}

/** "2026-11-10" → "2026년 11월 10일" */
export function koDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
