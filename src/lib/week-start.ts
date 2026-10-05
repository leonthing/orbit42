/** 주 시작 요일 — 웹 설정(users.week_start). iOS 는 기기 설정(AppSettings.WeekStart)을 따로 쓴다. */
export type WeekStart = "mon" | "sun";

const MON_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const SUN_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayLabels(ws: WeekStart): string[] {
  return ws === "sun" ? SUN_LABELS : MON_LABELS;
}

/** 그 주에서 몇 번째 칸인지 (0 = 주 시작 요일) */
export function weekdayIndex(d: Date, ws: WeekStart): number {
  return ws === "sun" ? d.getDay() : (d.getDay() + 6) % 7;
}

/** 칸 번호 → 토요일/일요일 여부 (주말 색칠용) */
export const saturdayIndex = (ws: WeekStart) => (ws === "sun" ? 6 : 5);
export const sundayIndex = (ws: WeekStart) => (ws === "sun" ? 0 : 6);

export function normalizeWeekStart(v: unknown): WeekStart {
  return v === "sun" ? "sun" : "mon";
}
