import type { Config } from "tailwindcss";

function rgbVar(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        charcoal: {
          50: rgbVar("--c-50"),
          100: rgbVar("--c-100"),
          200: rgbVar("--c-200"),
          300: rgbVar("--c-300"),
          400: rgbVar("--c-400"),
          500: rgbVar("--c-500"),
          600: rgbVar("--c-600"),
          700: rgbVar("--c-700"),
          800: rgbVar("--c-800"),
          900: rgbVar("--c-900"),
          950: rgbVar("--c-950"),
        },
      },
      // 타이포 스케일 — 9 / 11 / 13 / 15 px.
      // iOS 앱(.caption2·.caption·.footnote·.subheadline)과 같은 위계를 맞춘 값이다.
      // xs·sm 은 Tailwind 기본값(12·14)을 한 단계씩 키운 것이라, 이미 쓰인
      // 778 곳이 클래스 변경 없이 함께 커진다. 임의 크기(text-[10px] 등)는
      // 2xs·3xs 로 흡수하고 새로 만들지 않는다.
      fontSize: {
        "3xs": ["0.5625rem", { lineHeight: "0.75rem" }], // 9px — 달력 격자 등 초소형 라벨
        "2xs": ["0.6875rem", { lineHeight: "0.9375rem" }], // 11px — 배지·메타 라벨
        xs: ["0.8125rem", { lineHeight: "1.125rem" }], // 13px — 보조 텍스트
        sm: ["0.9375rem", { lineHeight: "1.375rem" }], // 15px — 본문
      },
      fontFamily: {
        sans: [
          "var(--font-pretendard)",
          "var(--font-inter)",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
