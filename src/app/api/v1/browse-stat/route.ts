import { waitUntil } from "@vercel/functions";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** 둘러보기 안 단계 (1.8.0) — app_browse_step_daily 의 check 와 같은 목록만 받는다 */
const STEPS = new Set([
  "tab_calendar", "tab_bookings", "tab_orbit", "tab_asset", "tab_profile",
  "prompt_event", "prompt_link", "prompt_booking", "prompt_other",
  "sheet_signup", "sheet_login", "sheet_close", "banner_signup",
]);

/**
 * POST — 앱 '가입 없이 둘러보기' 익명 집계 (개선-47). { step }
 * - start·signup → app_browse_daily, 둘러보기 안 단계(STEPS) → app_browse_step_daily (1.8.0)
 * 로그인 없이 받는다. 날짜·단계별 횟수만 +1, 사람을 알아볼 값은 저장하지 않는다.
 * 늘 204 — 기록 실패가 화면에 영향을 주지 않게.
 * 세지 않는 곳: 프리뷰 배포, 로컬 개발 서버(운영 DB 를 쓰므로 시뮬레이터·UI 테스트가 섞인다 — 시험할 땐 BROWSE_STAT_DEV=1).
 */
export async function POST(request: Request) {
  let step: unknown;
  try {
    step = (await request.json())?.step;
  } catch {
    return new Response(null, { status: 204 });
  }
  if (process.env.VERCEL_ENV === "preview") return new Response(null, { status: 204 });
  if (process.env.NODE_ENV !== "production" && process.env.BROWSE_STAT_DEV !== "1") {
    return new Response(null, { status: 204 });
  }
  const legacy = step === "start" || step === "signup";
  if (!legacy && !(typeof step === "string" && STEPS.has(step))) {
    return new Response(null, { status: 204 });
  }
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // 한국 날짜
  const task = (async () => {
    const { error } = legacy
      ? await getAdminClient().rpc("bump_app_browse", { p_day: day, p_step: step })
      : await getAdminClient().rpc("bump_app_browse_step", { p_day: day, p_step: step });
    if (error) console.error("browse-stat", error.message);
  })();
  try {
    waitUntil(task);
  } catch {
    await task;
  }
  return new Response(null, { status: 204 });
}
