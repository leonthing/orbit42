"use client";

import { useEffect, useRef } from "react";
import { rememberFunnelVia } from "@/lib/funnel-client";

/**
 * 방문 흐름 단계를 페이지가 처음 뜰 때 한 번만 알린다 (개선-32).
 * 서버 렌더에서 세면 새로고침·서버 액션 뒤 다시 그릴 때마다 늘어나서, 브라우저에서 한 번만 보낸다.
 * JS 를 돌리지 않는 크롤러는 자연히 빠진다. 본인 열람·봇 UA 는 서버가 한 번 더 거른다.
 */
export function FunnelBeacon(props: { step: "profile_view"; hostUsername: string } | { step: "slot_view"; slotId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const body =
      props.step === "profile_view"
        ? { step: "profile_view", hostUsername: props.hostUsername, source: "web" }
        : { step: "slot_view", slotId: props.slotId, source: "web", via: rememberFunnelVia(props.slotId) };
    void fetch("/api/v1/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }, [props]);
  return null;
}
