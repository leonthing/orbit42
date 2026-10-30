import { funnelRefFrom, type FunnelRef } from "@/lib/funnel-ref";

/**
 * 브라우저에서 방문 흐름 단계를 알린다 (개선-32) — 응답을 기다리지 않고, 실패해도 조용히 넘어간다.
 */
export function reportFunnel(slotId: string, step: "slot_view" | "time_picked") {
  try {
    void fetch("/api/v1/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slotId, step, source: "web", via: funnelVia(slotId), ref: funnelRef() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 무시
  }
}

/**
 * 방문 출처(?via=card, 1.7.0 공유 카드) — 처음 열 때 주소에서 읽어 이 탭에 기억해 두고, 시간 고름·예약 때 함께 보낸다.
 * 정해 둔 값(card)만. 주소·리퍼러는 보내지 않는다.
 */
export function rememberFunnelVia(slotId: string): "card" | undefined {
  try {
    const v = new URLSearchParams(window.location.search).get("via");
    if (v === "card") {
      sessionStorage.setItem(`funnel-via:${slotId}`, "card");
      return "card";
    }
  } catch {
    // 무시
  }
  return funnelVia(slotId);
}

export function funnelVia(slotId: string): "card" | undefined {
  try {
    return sessionStorage.getItem(`funnel-via:${slotId}`) === "card" ? "card" : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 방문 출처 범주 (1.8.0) — 이 탭에서 처음 들어온 곳(리퍼러 도메인·앱 안 브라우저)을 범주로만 기억해 두고,
 * 링크 페이지 → 예약 링크 → 시간 고름 → 예약까지 같은 범주로 센다. 범주 이름만 보낸다(주소·도메인·UA는 보내지 않음).
 */
export function funnelRef(): FunnelRef | undefined {
  try {
    const saved = sessionStorage.getItem("funnel-ref");
    if (saved) return saved as FunnelRef;
    let host = "";
    try {
      host = document.referrer ? new URL(document.referrer).hostname : "";
    } catch {
      host = "";
    }
    const ref = funnelRefFrom(host, navigator.userAgent);
    sessionStorage.setItem("funnel-ref", ref);
    return ref;
  } catch {
    return undefined;
  }
}
