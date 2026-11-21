import type { Metadata } from "next";
import { listMyHostBookings, listMyGuestBookings } from "@/lib/slots";
import { listMyReviewedBookingIds } from "@/lib/reviews";
import { listRequestsForHost } from "@/lib/time-requests";
import BookingsInbox from "./BookingsInbox";
import { TimeRequestsInbox } from "./TimeRequestsInbox";
import { Segmented } from "@/components/Segmented";
import { currentUserId } from "@/lib/messages";
import { v190OpenFor } from "@/lib/dm-flags";
import { DmList } from "@/app/messages/DmList";
import { DmSplit, DmPickHint } from "@/app/messages/DmSplit";
import { bookingsTabs } from "./tabs";

export const metadata: Metadata = { title: "예약" };
export const dynamic = "force-dynamic";

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams?: { tab?: string };
}) {
  const dmOpen = v190OpenFor(await currentUserId());
  // 1:1 대화 — iOS 예약 탭 '대화' 세그먼트(옛 /messages 는 여기로 넘긴다)
  if (searchParams?.tab === "chats" && dmOpen) {
    return (
      // PC(lg 이상): 세그먼트 아래 2단 — 왼쪽 목록, 오른쪽은 고른 대화가 없다는 안내(묶음 사). 휴대폰은 목록만, 그대로.
      <div className="space-y-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-4 lg:space-y-0">
        <Segmented value="chats" items={bookingsTabs(params.username, true)} />
        <DmSplit list={<DmList pane />} inThread={false}>
          <DmPickHint />
        </DmSplit>
      </div>
    );
  }
  const [hostBookings, guestBookings, hostArchived, guestArchived, reviewedIds, timeRequests] =
    await Promise.all([
      listMyHostBookings(),
      listMyGuestBookings(),
      listMyHostBookings({ archived: true }),
      listMyGuestBookings({ archived: true }),
      listMyReviewedBookingIds(),
      listRequestsForHost(),
    ]);
  return (
    <div className="space-y-6">
      <BookingsInbox
        hostTop={<TimeRequestsInbox requests={timeRequests} />}
        timeRequestCount={timeRequests.length}
        username={params.username}
        hostBookings={hostBookings}
        guestBookings={guestBookings}
        hostArchived={hostArchived}
        guestArchived={guestArchived}
        reviewedBookingIds={reviewedIds}
        dmOpen={dmOpen}
      />
    </div>
  );
}
