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
