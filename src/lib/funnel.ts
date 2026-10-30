import { waitUntil } from "@vercel/functions";
import { getAdminClient } from "@/lib/supabase";
import type { FunnelRef } from "@/lib/funnel-ref";

/**
 * 예약 링크 방문 흐름 익명 집계 (개선-32).
 * 단계: profile_view(링크 페이지) → slot_view(예약 링크 페이지) → time_picked(시간 고름) → booked(예약 성공).
 * 날짜·호스트·예약 링크·단계·출처별 '횟수'만 +1 한다. 사람을 알아볼 값은 저장하지 않는다.
 * 웹 방문은 출처 범주(인스타·카카오·검색 등, 브라우저가 정한 이름만)별로도 센다(booking_funnel_ref_daily, 1.8.0).
 * 봇·프리뷰 배포·호스트 본인 열람·로컬 개발 서버(FUNNEL_DEV=1 없을 때)는 세지 않는다.
 * 기록은 응답 뒤로 미룬다(waitUntil) — 실패해도 페이지는 영향 없다.
 */
export type FunnelStep = "profile_view" | "slot_view" | "time_picked" | "booked";
export type FunnelSource = "web" | "ios";
/** 방문 출처(링크에 붙은 ?via=) — 정해 둔 값만 센다 (1.7.0 공유 카드) */
export type FunnelVia = "card";

/** 아무 문자열이나 받지 않는다 — 정해 둔 값이 아니면 null */
export function parseFunnelVia(v: unknown): FunnelVia | null {
  return v === "card" ? "card" : null;
}

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
  /** 공유 카드 등으로 들어온 방문이면 출처별 표에도 +1 (예약 링크 단계만) */
  via?: FunnelVia | null;
  /** 방문 출처 범주(웹만, 1.8.0) — 범주 이름만 받아 범주별 표에 +1 */
  ref?: FunnelRef | null;
}) {
  if (!args.hostId) return;
  if (process.env.VERCEL_ENV === "preview") return;
  // 로컬 개발 서버도 운영 DB 를 쓴다 — 시뮬레이터·로컬 웹으로 외부 호스트 링크를 열면 운영 집계에 섞이므로
  // 플래그(FUNNEL_DEV=1)를 켠 시험 때만 기록한다 (1.8.0, booking_funnel_daily·via·ref 표 모두)
  if (process.env.NODE_ENV !== "production" && process.env.FUNNEL_DEV !== "1") return;
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
      if (args.via && args.slotId && args.step !== "profile_view") {
        const { error: viaErr } = await getAdminClient().rpc("bump_booking_funnel_via", {
          p_day: todayKst(),
          p_host: args.hostId,
          p_slot: args.slotId,
          p_step: args.step,
          p_via: args.via,
        });
        if (viaErr) console.error("recordFunnel via", viaErr.message);
      }
      if (args.ref && args.source === "web") {
        const { error: refErr } = await getAdminClient().rpc("bump_booking_funnel_ref", {
          p_day: todayKst(),
          p_host: args.hostId,
          p_step: args.step,
          p_ref: args.ref,
        });
        if (refErr) console.error("recordFunnel ref", refErr.message);
      }
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
