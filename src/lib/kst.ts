// 한국 시간(KST, UTC+9, 서머타임 없음) 날짜 경계 — 서버 시간대(Vercel=UTC)와 무관하게 자른다(11/21 PO).
// 서버에서 new Date(y, m, d) · getFullYear() · setHours(0) 처럼 '서버 지역 시간'으로 자르면
// 한국 0~9시 일정이 전날·전달·작년으로 간다. 날짜 경계가 필요한 웹 lib 는 여기 도우미를 쓴다.

const KST_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

/** KST 기준 연·월(0부터)·일·요일(0=일) */
export function kstParts(d: Date): { y: number; m: number; d: number; dow: number } {
  const k = new Date(d.getTime() + KST_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), dow: k.getUTCDay() };
}

/** KST 그 날 0시의 실제 시각 */
export function kstMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d) - KST_MS);
}

/** KST 해당 연도 1월 1일 0시 */
export function kstYearStart(d: Date): Date {
  return kstMidnight(kstParts(d).y, 0, 1);
}

/** KST 달 시작(m 은 0부터, 범위를 넘으면 Date.UTC 처럼 넘어간다) */
export function kstMonthStart(y: number, m: number): Date {
  return kstMidnight(y, m, 1);
}

/** KST 기준 "YYYY-MM" */
export function kstMonthKey(d: Date): string {
  const p = kstParts(d);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}`;
}

/** KST 기준 주 시작(설정한 시작 요일) 0시 */
export function kstStartOfWeek(d: Date, ws: "mon" | "sun" = "mon"): Date {
  const p = kstParts(d);
  const back = ws === "sun" ? p.dow : (p.dow + 6) % 7;
  return new Date(kstMidnight(p.y, p.m, p.d).getTime() - back * DAY_MS);
}

/** n일 뒤 같은 시각(KST 는 서머타임이 없어 24시간 더하기와 같다) */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
