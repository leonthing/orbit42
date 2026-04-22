export const SITE = {
  title: "Orbit42",
  description: "Orbit around someone's time — share your calendar, sell your time.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org",
} as const;

export const NAV_ITEMS = [
  { href: "/calendar", label: "캘린더", icon: "calendar" },
  { href: "/slots", label: "타임슬롯", icon: "clock" },
  { href: "/services", label: "서비스", icon: "ticket" },
  { href: "/bookings", label: "예약", icon: "schedule" },
  { href: "/blog", label: "글", icon: "blog" },
  { href: "/settings", label: "설정", icon: "cog" },
] as const;
