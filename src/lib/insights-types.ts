// Client-safe types and constants for the time-insights feature.
// Split out from insights.ts so client components can import them
// without dragging googleapis (and its Node-only deps) into the
// browser bundle.

export type WorkDay =
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat";
export type WorkHours = Partial<Record<WorkDay, { start: string; end: string }>>;

export const DEFAULT_WORK_HOURS: WorkHours = {
  mon: { start: "09:00", end: "18:00" },
  tue: { start: "09:00", end: "18:00" },
  wed: { start: "09:00", end: "18:00" },
  thu: { start: "09:00", end: "18:00" },
  fri: { start: "09:00", end: "18:00" },
};

export const WORK_DAY_LABEL: Record<WorkDay, string> = {
  sun: "일",
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
};
