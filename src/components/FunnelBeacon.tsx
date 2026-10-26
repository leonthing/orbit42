"use client";

import { useEffect, useRef } from "react";
import { rememberFunnelVia } from "@/lib/funnel-client";

/**
 * 같은 탭에서 이미 보낸 단계인지 — 처음이면 표시해 두고 false.
 * 뒤로·앞으로 가기로 화면이 다시 붙을 때 한 번 더 세지 않게 (1.8.0).
 * sessionStorage 를 못 쓰는 환경(사파리 비공개 등)은 지금처럼 보낸다.
 */
function alreadySentInTab(key: string): boolean {
  try {
    const k = `funnel-sent:${key}`;
    if (sessionStorage.getItem(k)) return true;
    sessionStorage.setItem(k, "1");
  } catch {
    // 무시 — 보낸다
  }
  return false;
}

/**
 * 방문 흐름 단계를 페이지가 처음 뜰 때 한 번만 알린다 (개선-32).
 * 서버 렌더에서 세면 새로고침·서버 액션 뒤 다시 그릴 때마다 늘어나서, 브라우저에서 한 번만 보낸다.
 * 같은 탭 안에서는 (단계·호스트·예약 링크)마다 한 번만 — 새 탭에서 열면 다시 센다.
 * JS 를 돌리지 않는 크롤러는 자연히 빠진다. 본인 열람·봇 UA 는 서버가 한 번 더 거른다.
 */
export function FunnelBeacon(props: { step: "profile_view"; hostUsername: string } | { step: "slot_view"; slotId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    let body: Record<string, unknown>;
    let key: string;
    if (props.step === "profile_view") {
      body = { step: "profile_view", hostUsername: props.hostUsername, source: "web" };
      key = `profile_view:${props.hostUsername.toLowerCase()}`;
    } else {
      // 출처(?via)는 중복이어도 먼저 기억해 둔다 — 시간 고름·예약 단계에서 쓴다
      body = { step: "slot_view", slotId: props.slotId, source: "web", via: rememberFunnelVia(props.slotId) };
      key = `slot_view:${props.slotId}`;
    }
    if (alreadySentInTab(key)) return;
    void fetch("/api/v1/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }, [props]);
  return null;
}
