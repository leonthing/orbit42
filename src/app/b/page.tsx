import type { Metadata } from "next";
import GuestBookingClient from "./GuestBookingClient";

// 게스트 예약 관리 (개선-40) — 토큰은 주소의 '#' 뒤에만 있어 서버·로그로 가지 않는다.
export const metadata: Metadata = {
  title: "내 예약",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function GuestBookingPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-10">
      <GuestBookingClient />
    </main>
  );
}
