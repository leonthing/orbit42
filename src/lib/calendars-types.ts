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
  created_at: string;
};
