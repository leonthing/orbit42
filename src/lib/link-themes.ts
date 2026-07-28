/**
 * 공개 프로필(링크 페이지) 테마 — 크리에이터가 자기 브랜드 톤에 맞춰 고른다.
 *
 * 다크/라이트 모드와 무관하게 고정된 색을 쓴다 (SNS 에서 들어온 방문자에게
 * 항상 같은 얼굴로 보여야 하므로). 값은 인라인 스타일로 주입한다.
 */

export type LinkTheme = {
  key: string;
  label: string;
  /** 페이지 배경 — 그라디언트 또는 단색 */
  background: string;
  /** 카드/버튼 표면 */
  surface: string;
  /** 카드 테두리 */
  border: string;
  /** 본문 텍스트 */
  text: string;
  /** 보조 텍스트 */
  muted: string;
  /** 강조색 (예약 버튼·아이콘) */
  accent: string;
  /** 강조색 위 텍스트 */
  onAccent: string;
  /** 페이지 캔버스(스크롤 영역 전체) 단색 — 그라디언트 끝색과 같게 둔다 */
  canvas: string;
};

export const LINK_THEMES: LinkTheme[] = [
  {
    key: "default",
    label: "기본",
    background: "linear-gradient(180deg, #12121a 0%, #16161f 100%)",
    surface: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.10)",
    text: "#f5f5f7",
    muted: "rgba(245,245,247,0.55)",
    accent: "#6366f1",
    canvas: "#16161f",
    onAccent: "#ffffff",
  },
  {
    key: "light",
    label: "라이트",
    background: "linear-gradient(180deg, #ffffff 0%, #f3f4f8 100%)",
    surface: "#ffffff",
    border: "rgba(15,23,42,0.10)",
    text: "#16161d",
    muted: "rgba(22,22,29,0.55)",
    accent: "#6366f1",
    canvas: "#f3f4f8",
    onAccent: "#ffffff",
  },
  {
    key: "midnight",
    label: "미드나잇",
    background: "linear-gradient(180deg, #05060f 0%, #0d1030 100%)",
    surface: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.12)",
    text: "#eef0ff",
    muted: "rgba(238,240,255,0.55)",
    accent: "#818cf8",
    canvas: "#0d1030",
    onAccent: "#0b0d1f",
  },
  {
    key: "sunset",
    label: "선셋",
    background: "linear-gradient(180deg, #f97316 0%, #ea580c 100%)",
    surface: "rgba(255,255,255,0.16)",
    border: "rgba(255,255,255,0.24)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.75)",
    accent: "#ffffff",
    canvas: "#ea580c",
    onAccent: "#c2410c",
  },
  {
    key: "forest",
    label: "포레스트",
    background: "linear-gradient(180deg, #064e3b 0%, #022c22 100%)",
    surface: "rgba(255,255,255,0.10)",
    border: "rgba(255,255,255,0.16)",
    text: "#ecfdf5",
    muted: "rgba(236,253,245,0.65)",
    accent: "#34d399",
    canvas: "#022c22",
    onAccent: "#022c22",
  },
  {
    key: "rose",
    label: "로즈",
    background: "linear-gradient(180deg, #fdf2f8 0%, #fce7f3 100%)",
    surface: "#ffffff",
    border: "rgba(190,24,93,0.14)",
    text: "#4a044e",
    muted: "rgba(74,4,78,0.55)",
    accent: "#db2777",
    canvas: "#fce7f3",
    onAccent: "#ffffff",
  },
  {
    key: "ocean",
    label: "오션",
    background: "linear-gradient(180deg, #0c4a6e 0%, #082f49 100%)",
    surface: "rgba(255,255,255,0.10)",
    border: "rgba(255,255,255,0.16)",
    text: "#e0f2fe",
    muted: "rgba(224,242,254,0.65)",
    accent: "#38bdf8",
    canvas: "#082f49",
    onAccent: "#082f49",
  },
  {
    key: "mono",
    label: "모노",
    background: "linear-gradient(180deg, #fafafa 0%, #e7e7e9 100%)",
    surface: "#ffffff",
    border: "rgba(0,0,0,0.10)",
    text: "#111113",
    muted: "rgba(17,17,19,0.55)",
    accent: "#111113",
    canvas: "#e7e7e9",
    onAccent: "#ffffff",
  },
];

export function resolveLinkTheme(key: string | null | undefined): LinkTheme {
  return LINK_THEMES.find((t) => t.key === key) ?? LINK_THEMES[0];
}
