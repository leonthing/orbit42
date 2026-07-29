import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * 로그인한 사용자의 홈. 실제 캘린더는 `/[username]/calendar` 라 사용자명이
 * 필요한데, 로그인 직후·PWA 시작·"홈으로" 같은 자리에서는 사용자명을 모른다.
 * 그래서 사용자명이 필요 없는 고정 진입점을 두고 여기서 넘긴다.
 */
export default async function CalendarHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(`/${session.username}/calendar`);
}
