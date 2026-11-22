"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 휴대폰 대화 입력 중에는 떠 있는 탭 막대를 숨긴다(11/22 PO — TWA 에서 키보드 위로 탭 막대가 따라 올라와 글 칸을 약 60dp 가렸다).
 * 입력칸에 포커스가 있거나(키보드만 내린 경우는 제외), 키보드가 올라온 동안(visualViewport 높이가 가장 컸을 때보다 150px 넘게 줄면) <html data-chat-typing>.
 * 숨기기·높이 바꾸기는 globals.css 가 휴대폰(md 미만)에서만 한다. 대화 방·예약 대화 입력칸에만 붙인다.
 */
export function useChatTyping() {
  const focused = useRef(false);
  const base = useRef(0);
  const kbUp = useRef(false);
  // 포커스는 남았는데 키보드만 내린 경우(안드로이드 뒤로 키 등) — 탭 막대를 다시 보인다. 다음 포커스·키보드가 올라오면 풀린다.
  const kbClosed = useRef(false);
  const update = useCallback(() => {
    if (typeof window === "undefined") return;
    const h = window.visualViewport?.height ?? window.innerHeight;
    base.current = Math.max(base.current, h);
    const keyboard = base.current - h > 150;
    if (kbUp.current && !keyboard && focused.current) kbClosed.current = true;
    if (keyboard) kbClosed.current = false;
    kbUp.current = keyboard;
    document.documentElement.toggleAttribute("data-chat-typing", window.innerWidth < 768 && ((focused.current && !kbClosed.current) || keyboard));
  }, []);
  useEffect(() => {
    const vv = window.visualViewport;
    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.documentElement.removeAttribute("data-chat-typing");
    };
  }, [update]);
  return {
    onFocus: () => {
      focused.current = true;
      kbClosed.current = false;
      update();
    },
    onBlur: () => {
      focused.current = false;
      update();
    },
  };
}
