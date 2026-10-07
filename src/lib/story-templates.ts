/** 인스타 스토리용 예약 링크 이미지 템플릿 — 웹(next/og)과 iOS(StoryComposer)가 같은 색을 쓴다. */
export type StoryTemplate = {
  key: string;
  label: string;
  /** 배경 그라데이션 (위 → 아래) */
  from: string;
  to: string;
  text: string;
  sub: string;
  accent: string;
  /** 예약하기 버튼 */
  pillBg: string;
  pillText: string;
  qrDark: string;
  qrLight: string;
};

export const STORY_TEMPLATES: StoryTemplate[] = [
  { key: "indigo", label: "인디고", from: "#6366f1", to: "#312e81", text: "#ffffff", sub: "rgba(255,255,255,0.78)", accent: "#c7d2fe", pillBg: "#ffffff", pillText: "#312e81", qrDark: "#1e1b4b", qrLight: "#ffffff" },
  { key: "sunset", label: "노을", from: "#f97316", to: "#db2777", text: "#ffffff", sub: "rgba(255,255,255,0.82)", accent: "#fde68a", pillBg: "#ffffff", pillText: "#9d174d", qrDark: "#831843", qrLight: "#ffffff" },
  { key: "forest", label: "포레스트", from: "#10b981", to: "#065f46", text: "#ffffff", sub: "rgba(255,255,255,0.8)", accent: "#a7f3d0", pillBg: "#ffffff", pillText: "#065f46", qrDark: "#064e3b", qrLight: "#ffffff" },
  { key: "paper", label: "페이퍼", from: "#F5F3EE", to: "#ECE8DF", text: "#18181b", sub: "#52525b", accent: "#6366f1", pillBg: "#18181b", pillText: "#ffffff", qrDark: "#18181b", qrLight: "#F5F3EE" },
  { key: "midnight", label: "미드나잇", from: "#1e293b", to: "#0f172a", text: "#ffffff", sub: "rgba(255,255,255,0.7)", accent: "#a5b4fc", pillBg: "#6366f1", pillText: "#ffffff", qrDark: "#0f172a", qrLight: "#ffffff" },
];

export function storyTemplate(key: string | null | undefined): StoryTemplate {
  return STORY_TEMPLATES.find((t) => t.key === key) ?? STORY_TEMPLATES[0];
}
