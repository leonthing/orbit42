import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 알림·메일의 "/bookings" 링크를 내 예약 화면으로 보낸다.
 * 시간 변경 제안 메일 버튼과 앱 내 알림이 이 주소를 쓰는데, 지금까지는 404였다.
 * 로그인 전이면 로그인 화면으로 보낸다.
 */
export default async function BookingsRedirect() {
  const session = await getSession();
  if (!session?.username) redirect("/login");
  redirect(`/${session.username}/bookings`);
}
