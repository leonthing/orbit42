import { PURPOSE_OPTIONS, CALENDAR_COLORS } from "./calendar-settings-types";
import type { CalendarPurpose } from "./calendar-settings-types";

export { PURPOSE_OPTIONS, CALENDAR_COLORS };
export type { CalendarPurpose };

export type CalendarVisibility = "private" | "followers" | "public";
export type CalendarSource = "native" | "google";

export type Calendar = {
  id: string;
  user_id: string;
  name: string;
  purpose: CalendarPurpose | null;
  color: string;
  visibility: CalendarVisibility;
  source: CalendarSource;
  google_calendar_id: string | null;
  google_account_id: string | null;
  is_default: boolean;
  /** A2: 캘린더별 시간당 단가(원) — null 이면 기준 시급 사용 */
  hourly_rate_krw: number | null;
  /** 목표 캘린더 — 이 캘린더에 쌓이는 시간이 하나의 목표를 향한다 */
  goal_title: string | null;
  /** 누적 목표 시간 (예: 200시간 채우기) */
  goal_target_hours: number | null;
  /** 목표 기한 "YYYY-MM-DD" */
  goal_deadline: string | null;
  /** 목표 시작 시점 — 이후 일정만 진행률에 집계 */
  goal_started_at: string | null;
  /** 아카이브된 캘린더 (달성/종료) — 목록·필터에서 접힘 */
  archived_at: string | null;
  created_at: string;
};
