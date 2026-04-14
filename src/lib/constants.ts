export const SITE = {
  title: "Orbit42",
  description: "Orbit around someone's time — share your calendar, sell your time.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org",
} as const;

export const NAV_ITEMS = [
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/slots", label: "Timeslots", icon: "clock" },
  { href: "/services", label: "Services", icon: "ticket" },
  { href: "/bookings", label: "Bookings", icon: "schedule" },
  { href: "/blog", label: "Posts", icon: "blog" },
] as const;
