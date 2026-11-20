import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 메시지 목록은 iOS 처럼 예약 탭 '대화'로 옮겼다(PO 11/21). 옛 주소·알림 링크는 그리로 넘긴다. 대화방 /messages/{id} 는 그대로. */
export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(`/${session.username}/bookings?tab=chats`);
}
