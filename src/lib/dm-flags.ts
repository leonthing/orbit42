import { privacy190State } from "@/lib/legal-change";

/**
 * 1.9.0 기능(1:1 대화, 할 일·후속 일정)을 켜는 때 — 처리방침 시행일(11/20 KST)부터 저절로 켜진다(Leo 11/12).
 * 그 전에는 웹 1:1 메시지(2026-04)도 '준비 중'으로 막아 둔다: 요청·수락·차단 규칙이 없고 처리방침에도 없던 기능이라.
 * 로컬 실측만 NEXT_PUBLIC_V190_FORCE_OPEN=1 로 미리 켠다(운영에는 넣지 않는다).
 */
export function v190Open(now: Date = new Date()): boolean {
  // 비상 스위치: 운영 env V190_OFF=1 이면 시행일이 지나도 닫는다(코드 배포 없이 env 바꾸고 재배포만, PO 11/13)
  if (process.env.V190_OFF === "1") return false;
  if (process.env.NEXT_PUBLIC_V190_FORCE_OPEN === "1") return true;
  return privacy190State(now) === "effective";
}

export const WEB_DM_CLOSED_MESSAGE = "1:1 대화는 새 단장 중이에요. 11월 20일에 다시 열어 드릴게요.";
export const V190_CLOSED_MESSAGE = "11월 20일부터 쓸 수 있어요.";
