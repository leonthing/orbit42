export const SITE = {
  title: "Orbit42",
  description: "기술, 농업, 그리고 그 사이의 모든 것에 대한 블로그",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org",
  author: "Leo Kim",
  email: "leo@orbit42.org",
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
] as const;

export const POSTS_PER_PAGE = 10;
