"use client";

import { useCallback, useRef } from "react";

/**
 * 휴대폰 좌우 밀기 → 앞/뒤로 넘기기 (iOS 캘린더 1.10.0 과 같은 규칙, 11/21 Leo).
 *
 * - 휴대폰 폭(768px 미만)에서만. PC 는 아무것도 하지 않는다.
 * - 화면 왼쪽·오른쪽 끝 20px 에서 시작한 밀기는 무시 — 안드로이드 크롬/TWA 의 가장자리 '뒤로' 제스처와 겹치지 않게.
 * - 방향은 처음 10px 움직일 때 정한다: 가로가 세로의 1.5배를 넘을 때만 '가로'. 세로로 정해지면 끝까지 손대지 않는다(시간축 스크롤).
 * - 손을 뗄 때 가로 48px 이상(빠르면 30px·250ms 안)이면 넘긴다. 탭(체크 칸·날짜 칸)은 거리가 모자라 그대로 탭.
 * - 넘긴 뒤 짧게 미끄러지는 전환 — '동작 줄이기' 설정이면 생략.
 *
 * 붙일 요소에는 `touch-action: pan-y` 를 같이 줘서 세로 스크롤은 브라우저가, 가로는 이 훅이 맡게 한다.
 */
export function useHorizontalSwipe(onSwipe: (dir: -1 | 1) => void) {
  const cb = useRef(onSwipe);
  cb.current = onSwipe;
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((el: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;

    const EDGE = 20;
    let sx = 0;
    let sy = 0;
    let st = 0;
    let dx = 0;
    let dy = 0;
    let lock: "h" | "v" | null = null;
    let active = false;

    const start = (e: TouchEvent) => {
      active = false;
      if (e.touches.length !== 1 || window.innerWidth >= 768) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      sx = t.clientX;
      sy = t.clientY;
      st = Date.now();
      dx = 0;
      dy = 0;
      lock = null;
      active = true;
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      if (e.touches.length !== 1) {
        active = false;
        return;
      }
      const t = e.touches[0];
      dx = t.clientX - sx;
      dy = t.clientY - sy;
      if (!lock && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        lock = Math.abs(dx) > Math.abs(dy) * 1.5 ? "h" : "v";
      }
    };
    const end = () => {
      if (!active) return;
      active = false;
      if (lock !== "h") return;
      const ax = Math.abs(dx);
      const fast = Date.now() - st < 250;
      if (!(ax >= 48 || (fast && ax >= 30)) || ax <= Math.abs(dy) * 1.5) return;
      const dir: -1 | 1 = dx < 0 ? 1 : -1;
      cb.current(dir);
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduce && typeof el.animate === "function") {
        // 다음 그림이 그려진 뒤 새 내용이 미는 쪽에서 들어오게
        requestAnimationFrame(() => {
          el.animate(
            [
              { transform: `translateX(${dir * 28}px)`, opacity: 0.5 },
              { transform: "translateX(0)", opacity: 1 },
            ],
            { duration: 180, easing: "ease-out" },
          );
        });
      }
    };
    const cancel = () => {
      active = false;
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", cancel, { passive: true });
    cleanup.current = () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
    };
  }, []);
}
