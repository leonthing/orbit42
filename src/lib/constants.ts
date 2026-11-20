export const SITE = {
  title: "Orbit42",
  // 포지셔닝: "시간을 자산으로 만드는 캘린더" (2026-07-27 확정, SNS 표현 폐기)
  description:
    "시간을 자산으로 만드는 캘린더. 캘린더에 쌓인 시간을 돈으로 환산해 보여주고, 남는 시간은 예약 링크로 팔 수 있어요.",
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
  // 휴대폰 아래 탭·iOS 1.10.0 과 같은 5개·같은 순서(11/21 묶음 나). 예약 링크·대화는 예약 안 세그먼트,
  // 설정은 메뉴 맨 아래. match 는 이 메뉴를 강조할 하위 주소(예약 링크·대화도 '예약').
  { href: "/calendar", label: "캘린더", icon: "calendar", match: ["/calendar"] },
  { href: "/bookings", label: "예약", icon: "schedule", match: ["/bookings", "/slots"] },
  { href: "/people", label: "오르빗", icon: "users", match: ["/people"] },
  { href: "/insights", label: "리포트", icon: "chart", match: ["/insights"] },
  { href: "", label: "프로필", icon: "user", match: [] },
] as const;

/** 사이드바 '더보기' — 쓰는 사람만 쓰는 메뉴는 아래로 (주소는 그대로 살아 있다) */
export const NAV_MORE_ITEMS = [
  { href: "/timeline", label: "타임라인", icon: "blog" },
  { href: "/services", label: "서비스 메뉴", icon: "ticket" },
  { href: "/blog", label: "블로그", icon: "blog" },
] as const;

/** iOS 앱 App Store 주소 — 아이폰 방문자의 가입/로그인 링크는 여기로 보낸다. */
export const APP_STORE_URL = "https://apps.apple.com/kr/app/id6795434941";
