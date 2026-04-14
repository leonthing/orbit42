import type { Metadata } from "next";
import { listMyHostBookings } from "@/lib/slots";
import type { BookingRow } from "@/lib/slots";
import BookingsInbox from "./BookingsInbox";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { mock?: string };
}) {
  const useMock = searchParams.mock === "1";
  const bookings = useMock ? mockBookings() : await listMyHostBookings();
  return <BookingsInbox initial={bookings} isMock={useMock} />;
}

function mockBookings(): BookingRow[] {
  const now = new Date();
  const daysFromNow = (n: number, hour = 14, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const iso = (d: Date) => d.toISOString();
  const plusMin = (d: Date, m: number) =>
    new Date(d.getTime() + m * 60_000);

  const rows: Array<{
    id: string;
    start: Date;
    duration: number;
    status: string;
    slotTitle: string;
    slug: string;
    guest: BookingRow["guest"];
    guestName: string | null;
    guestEmail: string | null;
    message: string | null;
  }> = [
    {
      id: "mock-1",
      start: daysFromNow(0, 16),
      duration: 30,
      status: "pending",
      slotTitle: "30분 1:1 프로덕트 멘토링",
      slug: "30min-1on1-mentoring",
      guest: { username: "jiho", display_name: "김지호" },
      guestName: null,
      guestEmail: null,
      message: "초기 단계 SaaS 피봇 관련해서 의견 듣고 싶습니다.",
    },
    {
      id: "mock-2",
      start: daysFromNow(1, 10, 30),
      duration: 60,
      status: "confirmed",
      slotTitle: "창업 커피챗",
      slug: "coffee-chat",
      guest: { username: "suh_yj", display_name: "서유진" },
      guestName: null,
      guestEmail: null,
      message: null,
    },
    {
      id: "mock-3",
      start: daysFromNow(3, 19),
      duration: 90,
      status: "pending",
      slotTitle: "저녁 러닝 & 이야기",
      slug: "evening-run",
      guest: null,
      guestName: "박현우",
      guestEmail: "hyunwoo@example.com",
      message: "초보인데 페이스 맞출 수 있을까요?",
    },
    {
      id: "mock-4",
      start: daysFromNow(-2, 11),
      duration: 30,
      status: "completed",
      slotTitle: "30분 1:1 프로덕트 멘토링",
      slug: "30min-1on1-mentoring",
      guest: { username: "lena", display_name: "이세나" },
      guestName: null,
      guestEmail: null,
      message: null,
    },
    {
      id: "mock-5",
      start: daysFromNow(-5, 15),
      duration: 60,
      status: "canceled",
      slotTitle: "창업 커피챗",
      slug: "coffee-chat",
      guest: null,
      guestName: "최민석",
      guestEmail: "minseok@example.com",
      message: "당일 일정이 생겨 부득이 취소합니다. 죄송합니다.",
    },
  ];

  return rows.map((r) => ({
    id: r.id,
    scheduled_at: iso(r.start),
    scheduled_end_at: iso(plusMin(r.start, r.duration)),
    status: r.status,
    message: r.message,
    guest_name: r.guestName,
    guest_email: r.guestEmail,
    guest: r.guest,
    slot: { title: r.slotTitle, slug: r.slug },
  }));
}
