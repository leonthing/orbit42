export type CalendarVisibility = "private" | "followers" | "public";

export type CalendarPurpose =
  | "personal"
  | "work"
  | "couple"
  | "income"
  | "hobby"
  | "other";

export type CalendarSetting = {
  google_calendar_id: string;
  visibility: CalendarVisibility;
  label_override: string | null;
  purpose: CalendarPurpose | null;
  color_override: string | null;
};

export const PURPOSE_OPTIONS: { value: CalendarPurpose; label: string }[] = [
  { value: "personal", label: "개인" },
  { value: "work", label: "업무" },
  { value: "couple", label: "커플" },
  { value: "income", label: "수익" },
  { value: "hobby", label: "취미" },
  { value: "other", label: "기타" },
];

export const CALENDAR_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ef4444", // red
];
