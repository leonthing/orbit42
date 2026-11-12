import { privacy190State } from "@/lib/legal-change";

/**
 * 1.9.0 기능(1:1 대화, 할 일·후속 일정)을 켜는 때 — 처리방침 시행일(11/20 KST)부터 저절로 켜진다(Leo 11/12).
 * 그 전에는 웹 1:1 메시지(2026-04)도 '준비 중'으로 막아 둔다: 요청·수락·차단 규칙이 없고 처리방침에도 없던 기능이라.
 * 로컬 실측만 NEXT_PUBLIC_V190_FORCE_OPEN=1 로 미리 켠다(운영에는 넣지 않는다).
 */
export function v190Open(now: Date = new Date()): boolean {
  if (process.env.NEXT_PUBLIC_V190_FORCE_OPEN === "1") return true;
  return privacy190State(now) === "effective";
}

export const WEB_DM_CLOSED_MESSAGE = "1:1 대화는 새 단장 중이에요. 11월 20일에 다시 열어 드릴게요.";
export const V190_CLOSED_MESSAGE = "11월 20일부터 쓸 수 있어요.";
