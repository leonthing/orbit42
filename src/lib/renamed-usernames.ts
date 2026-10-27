/**
 * 아이디를 바꾼 계정의 옛 아이디 → 새 아이디 (Edge·Node 공용, DB 조회 없음).
 * - 세션(웹 쿠키·앱 토큰·연동 토큰)에 옛 아이디가 들어 있어도 새 아이디로 읽는다 → 다시 로그인 없이 계속 동작.
 * - 옛 주소 /<옛 아이디>/… 는 미들웨어가 308로 새 주소로 넘긴다(공유된 링크·지난 메일·알림 링크).
 * - 옛 아이디는 예약어로 막아 다른 사람이 가져가지 못한다.
 * - 추천 링크 ?ref=<옛 아이디> 도 새 아이디로 찾는다.
 * 2026-10-28 Leo 요청: leokim5854 → leokim.
 */
export const RENAMED_USERNAMES: Readonly<Record<string, string>> = {
  leokim5854: "leokim",
};

/** 옛 아이디면 새 아이디로, 아니면 그대로 */
export function currentUsername(username: string): string {
  return RENAMED_USERNAMES[username.toLowerCase()] ?? username;
}
