export const SITE = {
  title: "Orbit42",
  description: "Orbit around someone's time — share your calendar, sell your time.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org",
} as const;

export const NAV_ITEMS = [
  { href: "", label: "Calendar", icon: "calendar" }, // = /[username]
  { href: "/calendar", label: "Schedule", icon: "schedule" },
  { href: "/slots", label: "Slots", icon: "clock" },
  { href: "/bookings", label: "Bookings", icon: "ticket" },
  { href: "/blog", label: "Posts", icon: "blog" },
] as const;
