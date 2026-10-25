/**
 * 브라우저에서 방문 흐름 단계를 알린다 (개선-32) — 응답을 기다리지 않고, 실패해도 조용히 넘어간다.
 */
export function reportFunnel(slotId: string, step: "slot_view" | "time_picked") {
  try {
    void fetch("/api/v1/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slotId, step, source: "web", via: funnelVia(slotId) }),
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
