import type { Metadata } from "next";
import { listMyHostBookings } from "@/lib/slots";
import BookingsInbox from "./BookingsInbox";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const bookings = await listMyHostBookings();
  return <BookingsInbox initial={bookings} />;
}
