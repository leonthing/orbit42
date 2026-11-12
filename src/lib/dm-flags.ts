/**
 * 웹 1:1 메시지(2026-04, conversations·messages) — 1.9.0 1:1 대화 출시 전까지 막는다(Leo 11/12 승인).
 * 요청·수락·차단 규칙이 없고 처리방침에도 없던 기능이라, 화면은 '준비 중'으로, 시작·보내기·읽기 API 는 거절.
 * 표와 데이터는 그대로 둔다. 1.9.0 에서 새 규칙과 함께 true 로 바꾼다.
 */
export const WEB_DM_OPEN = false;
export const WEB_DM_CLOSED_MESSAGE = "1:1 메시지는 새 단장 중이에요. 곧 다시 열어 드릴게요.";
