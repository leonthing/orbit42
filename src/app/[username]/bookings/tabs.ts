/** 예약 탭 세그먼트 — iOS 와 같은 순서: 받은 예약 · 내가 한 예약 · 대화(1:1, 열렸을 때) · 예약 링크 */
export type BookingsTab = "host" | "guest" | "chats" | "slots";

export function bookingsTabs(username: string, dmOpen: boolean) {
  return [
    { value: "host" as const, label: "받은 예약", href: `/${username}/bookings?tab=host` },
    { value: "guest" as const, label: "내가 한 예약", href: `/${username}/bookings?tab=guest` },
    ...(dmOpen ? [{ value: "chats" as const, label: "대화", href: `/${username}/bookings?tab=chats` }] : []),
    { value: "slots" as const, label: "예약 링크", href: `/${username}/slots` },
  ];
}
