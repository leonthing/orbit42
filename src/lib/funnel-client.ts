/**
 * 브라우저에서 방문 흐름 단계를 알린다 (개선-32) — 응답을 기다리지 않고, 실패해도 조용히 넘어간다.
 */
export function reportFunnel(slotId: string, step: "slot_view" | "time_picked") {
  try {
    void fetch("/api/v1/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slotId, step, source: "web" }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 무시
  }
}
