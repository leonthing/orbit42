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

/** KST 기준 "YYYY-MM-DD" */
export function kstDateKey(d: Date): string {
  const p = kstParts(d);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ALL_DAY_SPAN = 366;

/** 종일 일정의 한쪽 끝이 KST 로 어느 날인지 — 저장 형식 셋을 모두 받는다 */
function allDayEdgeKey(s: string, edge: "start" | "end"): string | null {
  // ① 날짜만 문자열(구글에서 읽은 값 — 끝은 이미 '마지막 날 포함'으로 바꿔 둔다: googleAllDayEndToInclusive)
  if (DATE_ONLY.test(s)) return s;
  const d = new Date(s);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  // ② UTC 0시 — iOS·v1 이 "YYYY-MM-DD" 로 보낸 값이 DB 에 들어간 것. 날짜 그대로, 끝도 포함
  if (t % DAY_MS === 0) return d.toISOString().slice(0, 10);
  // ③ KST 시각 — 웹은 0시 ~ 23:59:59(끝 포함). 끝이 딱 KST 0시면 '다음 날 0시(끝 제외)' 형식이라 하루 앞으로
  if (edge === "end" && (t + KST_MS) % DAY_MS === 0) return kstDateKey(new Date(t - 1));
  return kstDateKey(d);
}

/**
 * 종일 일정이 걸치는 KST 날짜("YYYY-MM-DD") 목록 — 하루·주·월 보기, 날짜 목록이 함께 쓴다(11/22 PO).
 * 예전엔 시작 날짜 하루에만 놓아서 여러 날 종일(휴가·출장)이 이틀째부터 안 보였다.
 * 끝이 없거나 시작보다 앞이면 시작 하루. 지나치게 긴 값은 366일에서 자른다.
 */
export function allDayKstDates(startAt: string, endAt?: string | null): string[] {
  const first = allDayEdgeKey(startAt, "start");
  if (!first) return [];
  const lastRaw = endAt ? allDayEdgeKey(endAt, "end") : null;
  const last = !lastRaw || lastRaw < first ? first : lastRaw;
  const out: string[] = [];
  const [y, m, d] = first.split("-").map(Number);
  for (let i = 0; i < MAX_ALL_DAY_SPAN; i++) {
    const key = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    if (key > last) break;
    out.push(key);
  }
  return out;
}

/** 일정이 그 KST 날짜(YYYY-MM-DD)에 보여야 하는지 — 종일은 걸치는 모든 날, 시간 일정은 시작한 날(지금 규칙 그대로) */
export function eventOnKstDate(e: { start_at: string; end_at?: string | null; all_day?: boolean | null }, key: string): boolean {
  if (e.all_day) return allDayKstDates(e.start_at, e.end_at).includes(key);
  return kstDateKey(new Date(e.start_at)) === key;
}
