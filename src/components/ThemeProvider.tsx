"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** 안드로이드 앱(TWA) 안 — 기기 화면 모드로 고정, 선택 숨김 */
  locked: boolean;
}>({ theme: "system", setTheme: () => {}, locked: false });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 기본은 '시스템'(묶음 5, PO 11/21) — 기기가 다크면 앱 화면도 다크
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    // TWA 판별은 layout 의 THEME_BOOT(첫 그리기 전)가 html[data-twa] 로 남긴다 — 여기선 따르기만
    if (document.documentElement.hasAttribute("data-twa")) {
      setLocked(true);
    } else {
      const saved = localStorage.getItem("orbit42-theme") as Theme | null;
      if (saved) setThemeState(saved);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        root.classList.toggle("dark", mq.matches);
      };
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    root.classList.toggle("dark", theme === "dark");
  }, [theme, mounted]);

  function setTheme(t: Theme) {
    if (locked) return;
    setThemeState(t);
    localStorage.setItem("orbit42-theme", t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, locked }}>
      {children}
    </ThemeContext.Provider>
  );
}
