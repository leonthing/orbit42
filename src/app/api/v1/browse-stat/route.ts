import { waitUntil } from "@vercel/functions";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST — 앱 '가입 없이 둘러보기' 익명 집계 (개선-47). { step: "start" | "signup" }
 * 로그인 없이 받는다. 날짜·단계별 횟수만 +1, 사람을 알아볼 값은 저장하지 않는다.
 * 늘 204 — 기록 실패가 화면에 영향을 주지 않게. 프리뷰 배포는 세지 않는다.
 */
export async function POST(request: Request) {
  let step: unknown;
  try {
    step = (await request.json())?.step;
  } catch {
    return new Response(null, { status: 204 });
  }
  if ((step !== "start" && step !== "signup") || process.env.VERCEL_ENV === "preview") {
    return new Response(null, { status: 204 });
  }
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // 한국 날짜
  const task = (async () => {
    const { error } = await getAdminClient().rpc("bump_app_browse", { p_day: day, p_step: step });
    if (error) console.error("browse-stat", error.message);
  })();
  try {
    waitUntil(task);
  } catch {
    await task;
  }
  return new Response(null, { status: 204 });
}
