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
  // 1:1 세션을 파는 사람의 하루 순서: 일정 → 내 예약 링크 → 들어온 예약 → 사람 → 정산
  { href: "/calendar", label: "캘린더", icon: "calendar" },
  { href: "/slots", label: "예약 링크", icon: "clock" },
  { href: "/bookings", label: "예약", icon: "schedule" },
  { href: "/people", label: "오르빗", icon: "users" },
  { href: "/insights", label: "시간 자산", icon: "chart" },
  { href: "/settings", label: "설정", icon: "cog" },
] as const;

/** 사이드바 '더보기' — 쓰는 사람만 쓰는 메뉴는 아래로 (주소는 그대로 살아 있다) */
export const NAV_MORE_ITEMS = [
  { href: "/timeline", label: "타임라인", icon: "blog" },
  { href: "/services", label: "서비스 메뉴", icon: "ticket" },
  { href: "/blog", label: "블로그", icon: "blog" },
] as const;
