import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
      },
      fontFamily: {
        sans: ["var(--font-pretendard)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      typography: ({ theme }: { theme: (path: string) => string }) => ({
        DEFAULT: {
          css: {
            "--tw-prose-body": theme("colors.charcoal.700"),
            "--tw-prose-headings": theme("colors.charcoal.900"),
            "--tw-prose-links": theme("colors.navy.600"),
            "--tw-prose-code": theme("colors.navy.700"),
            maxWidth: "none",
          },
        },
        invert: {
          css: {
            "--tw-prose-body": theme("colors.charcoal.300"),
            "--tw-prose-headings": theme("colors.charcoal.100"),
            "--tw-prose-links": theme("colors.navy.400"),
            "--tw-prose-code": theme("colors.navy.300"),
          },
        },
      }),
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
