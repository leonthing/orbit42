export const SITE = {
  title: "Orbit42",
  description: "Life Integration Platform",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org",
} as const;

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/business", label: "Business", icon: "briefcase" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/finance", label: "Finance", icon: "banknotes" },
  { href: "/network", label: "Network", icon: "users" },
  { href: "/notes", label: "Notes", icon: "pencil" },
  { href: "/map", label: "Map", icon: "map" },
  { href: "/profile", label: "Profile", icon: "user" },
] as const;
