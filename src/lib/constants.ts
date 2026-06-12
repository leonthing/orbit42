export const SITE = {
  title: "Orbit42",
  description:
    "시간 중심의 라이프 통합 플랫폼. 내 캘린더·슬롯·예약·글을 한 곳에서 공유하고, 다른 사람의 시간과 연결됩니다.",
  descriptionEn:
    "Orbit around someone's time — share your calendar, open bookable slots, and connect through time.",
  keywords: [
    "orbit42",
    "타임슬롯",
    "시간 공유",
    "일정 공유",
    "캘린더",
    "예약 플랫폼",
    "시간 기반 SNS",
    "커피챗",
    "멘토링",
    "1on1",
  ],
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org",
} as const;

export const NAV_ITEMS = [
  { href: "/calendar", label: "캘린더", icon: "calendar" },
  { href: "/slots", label: "타임슬롯", icon: "clock" },
  { href: "/services", label: "서비스", icon: "ticket" },
  { href: "/bookings", label: "예약", icon: "schedule" },
  { href: "/blog", label: "블로그", icon: "blog" },
  { href: "/settings", label: "설정", icon: "cog" },
] as const;
