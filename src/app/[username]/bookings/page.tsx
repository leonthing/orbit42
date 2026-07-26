import type { Metadata } from "next";
import { listMyHostBookings, listMyGuestBookings } from "@/lib/slots";
import { listMyReviewedBookingIds } from "@/lib/reviews";
import { listRequestsForHost } from "@/lib/time-requests";
import BookingsInbox from "./BookingsInbox";
import { TimeRequestsInbox } from "./TimeRequestsInbox";

export const metadata: Metadata = { title: "예약" };
export const dynamic = "force-dynamic";

export default async function BookingsPage({
  params,
}: {
  params: { username: string };
}) {
  const [hostBookings, guestBookings, reviewedIds, timeRequests] =
    await Promise.all([
      listMyHostBookings(),
      listMyGuestBookings(),
      listMyReviewedBookingIds(),
      listRequestsForHost(),
    ]);
  return (
    <div className="space-y-6">
      <TimeRequestsInbox requests={timeRequests} />
      <BookingsInbox
        username={params.username}
        hostBookings={hostBookings}
        guestBookings={guestBookings}
        reviewedBookingIds={reviewedIds}
      />
    </div>
  );
}
