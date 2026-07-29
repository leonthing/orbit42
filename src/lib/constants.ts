export const SITE = {
  title: "Orbit42",
  // 포지셔닝: "시간을 자산으로 만드는 캘린더" (2026-07-27 확정, SNS 표현 폐기)
  description:
    "시간을 자산으로 만드는 캘린더. 캘린더에 쌓인 시간을 돈으로 환산해 보여주고, 남는 시간은 타임슬롯으로 팔 수 있어요.",
  descriptionEn:
    "The calendar that turns your time into an asset — see what your hours are worth, and sell the ones you don't use.",
  keywords: [
    "orbit42",
    "시간 자산",
    "시간 관리",
    "캘린더",
    "타임슬롯",
    "프리랜서",
    "시급 계산",
    "예약 페이지",
    "커피챗",
    "멘토링",
  ],
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org",
} as const;

// Korean labels for the DB `slot_type` enum. The raw values ("1on1",
// "companion", "group") were leaking into the UI on several read surfaces.
export const SLOT_TYPE_LABELS: Record<string, string> = {
  "1on1": "1:1",
  companion: "동행",
  group: "그룹",
};

export function slotTypeLabel(t: string | null | undefined): string {
  if (!t) return "";
  return SLOT_TYPE_LABELS[t] ?? t;
}

export const NAV_ITEMS = [
  { href: "/calendar", label: "캘린더", icon: "calendar" },
  { href: "/timeline", label: "타임라인", icon: "blog" },
  { href: "/slots", label: "타임슬롯", icon: "clock" },
  { href: "/services", label: "서비스", icon: "ticket" },
  { href: "/bookings", label: "예약", icon: "schedule" },
  { href: "/insights", label: "시간 자산", icon: "chart" },
  { href: "/blog", label: "블로그", icon: "blog" },
  { href: "/settings", label: "설정", icon: "cog" },
] as const;
