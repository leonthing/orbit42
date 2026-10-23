import { waitUntil } from "@vercel/functions";
import { getAdminClient } from "@/lib/supabase";

/**
 * 예약 링크 방문 흐름 익명 집계 (개선-32).
 * 단계: profile_view(링크 페이지) → slot_view(예약 링크 페이지) → time_picked(시간 고름) → booked(예약 성공).
 * 날짜·호스트·예약 링크·단계·출처별 '횟수'만 +1 한다. 사람을 알아볼 값은 저장하지 않는다.
 * 봇·프리뷰 배포·호스트 본인 열람은 세지 않는다.
 * 기록은 응답 뒤로 미룬다(waitUntil) — 실패해도 페이지는 영향 없다.
 */
export type FunnelStep = "profile_view" | "slot_view" | "time_picked" | "booked";
export type FunnelSource = "web" | "ios";

const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|yeti|daum|headlesschrome|lighthouse|vercel|curl|wget|python-requests|node-fetch|axios/i;

export function isBotUserAgent(ua: string | null | undefined) {
  if (!ua) return true; // UA 없는 요청은 사람 브라우저가 아니다
  return BOT_UA.test(ua);
}

/** 한국 시간 기준 날짜 (YYYY-MM-DD) */
function todayKst() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function recordFunnel(args: {
  hostId: string | null | undefined;
  slotId?: string | null;
  step: FunnelStep;
  source: FunnelSource;
  /** 보는 사람(로그인했으면) — 호스트 본인이면 세지 않는다. 저장하지 않는다. */
  viewerId?: string | null;
  userAgent?: string | null;
}) {
  if (!args.hostId) return;
  if (process.env.VERCEL_ENV === "preview") return;
  if (args.viewerId && args.viewerId === args.hostId) return;
  // 앱(iOS)은 자기 UA를 보내므로 봇 판정은 웹에서만
  if (args.source === "web" && isBotUserAgent(args.userAgent)) return;

  const task = (async () => {
    try {
      const { error } = await getAdminClient().rpc("bump_booking_funnel", {
        p_day: todayKst(),
        p_host: args.hostId,
        p_slot: args.slotId ?? null,
        p_step: args.step,
        p_source: args.source,
      });
      if (error) console.error("recordFunnel", error.message);
    } catch (err) {
      console.error("recordFunnel", err);
    }
  })();
  try {
    waitUntil(task);
  } catch {
    // waitUntil 을 쓸 수 없는 환경(로컬 등) — 그냥 진행되게 둔다
  }
}
