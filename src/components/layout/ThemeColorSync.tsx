"use client";

import { useEffect } from "react";

/** 앱 화면에서 주소창·상태줄 색(theme-color)을 화면 모드에 맞춘다 — 다크 #1A1A1F, 라이트 #F2F2F7(iOS 배경과 같음) */
export function ThemeColorSync() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      meta.content = root.classList.contains("dark") ? "#1A1A1F" : "#F2F2F7";
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mo.disconnect();
      // 앱 밖(공개 페이지)으로 나가면 기본(밝은 색)으로
      const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (meta) meta.content = "#F2F2F7";
    };
  }, []);
  return null;
}
