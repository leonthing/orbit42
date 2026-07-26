export type CalendarVisibility = "private" | "followers" | "public";

export type CalendarPurpose =
  | "personal"
  | "work"
  | "couple"
  | "income"
  | "invest"
  | "hobby"
  | "other"
  | "health"
  | "social"
  | "learning";

export type CalendarSetting = {
  google_calendar_id: string;
  visibility: CalendarVisibility;
  label_override: string | null;
  purpose: CalendarPurpose | null;
  color_override: string | null;
};

export const PURPOSE_OPTIONS: { value: CalendarPurpose; label: string }[] = [
  { value: "work", label: "업무" },
  { value: "income", label: "수익" },
  { value: "invest", label: "투자" },
  { value: "personal", label: "개인" },
  { value: "couple", label: "커플" },
  { value: "health", label: "건강" },
  { value: "social", label: "사교" },
  { value: "learning", label: "학습" },
  { value: "hobby", label: "취미" },
  { value: "other", label: "기타" },
];

/** Coarse grouping used by insights / time analytics. */
export type PurposeGroup = "work" | "personal" | "other";

export const PURPOSE_GROUP: Record<CalendarPurpose, PurposeGroup> = {
  work: "work",
  income: "work",
  invest: "personal",
  personal: "personal",
  couple: "personal",
  health: "personal",
  social: "personal",
  learning: "personal",
  hobby: "personal",
  other: "other",
};

export function purposeGroup(p: CalendarPurpose | null): PurposeGroup {
  return p ? PURPOSE_GROUP[p] : "other";
}

export const PURPOSE_GROUP_LABEL: Record<PurposeGroup, string> = {
  work: "업무",
  personal: "업무 외",
  other: "미분류",
};

export const PURPOSE_GROUP_COLOR: Record<PurposeGroup, string> = {
  work: "#ef4444", // red — work
  personal: "#10b981", // emerald — personal
  other: "#6b7280", // gray — uncategorized
};

export const CALENDAR_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ef4444", // red
];
